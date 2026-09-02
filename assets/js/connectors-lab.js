/*
 * Connectors Lab: a small, real simulator for how Flink consumes from a
 * partitioned source (Kafka topic partitions, Kinesis stream shards).
 *
 * Not a message broker — just enough mechanics to make partition/shard
 * assignment, starting position, and consumer lag (Module 07) concrete
 * and watchable, for either connector type.
 */

const CONNECTOR_TYPES = {
  kafka: {
    label: "Apache Kafka",
    unitLabel: "partition",
    unitLabelPlural: "partitions",
    nameLabel: "Topic",
    defaultName: "orders",
    startPositions: [
      { value: "earliest", label: "earliest — replay the full existing backlog" },
      { value: "latest", label: "latest — skip existing backlog, only new records" },
    ],
    replayValue: "earliest",
  },
  kinesis: {
    label: "AWS Kinesis Data Streams",
    unitLabel: "shard",
    unitLabelPlural: "shards",
    nameLabel: "Stream name",
    defaultName: "orders-stream",
    startPositions: [
      { value: "TRIM_HORIZON", label: "TRIM_HORIZON — replay the full existing backlog" },
      { value: "LATEST", label: "LATEST — skip existing backlog, only new records" },
    ],
    replayValue: "TRIM_HORIZON",
  },
};

// Fixed, deterministic per-unit backlog sizes (not random, so runs are reproducible and testable).
const BACKLOG_SIZES = [7, 4, 9, 5, 6, 3];

/**
 * Builds a fresh simulation state for a given source config.
 * config: { type: 'kafka'|'kinesis', name, unitCount, parallelism, startingPosition }
 */
function buildSimulation(config) {
  const replay = config.startingPosition === CONNECTOR_TYPES[config.type].replayValue;

  const partitions = [];
  for (let i = 0; i < config.unitCount; i++) {
    const total = replay ? BACKLOG_SIZES[i % BACKLOG_SIZES.length] : 0;
    partitions.push({ index: i, total, consumed: 0 });
  }

  const subtasks = [];
  for (let s = 0; s < config.parallelism; s++) {
    const assigned = [];
    for (let p = 0; p < config.unitCount; p++) {
      if (p % config.parallelism === s) assigned.push(p);
    }
    subtasks.push({ index: s, assigned, cursor: 0 });
  }

  return { config, partitions, subtasks, replay };
}

function totalLag(sim) {
  return sim.partitions.reduce((sum, p) => sum + (p.total - p.consumed), 0);
}

function isDone(sim) {
  return sim.partitions.every((p) => p.consumed >= p.total);
}

/**
 * Advances one tick: every subtask with backlog-holding assigned partitions
 * consumes exactly one record (round-robin across its own partitions).
 * Returns the list of {subtaskIndex, partitionIndex, offset} consumed this tick.
 */
function tick(sim) {
  const events = [];
  sim.subtasks.forEach((st) => {
    if (st.assigned.length === 0) return;
    for (let attempt = 0; attempt < st.assigned.length; attempt++) {
      const pIdx = st.assigned[(st.cursor + attempt) % st.assigned.length];
      const partition = sim.partitions[pIdx];
      if (partition.consumed < partition.total) {
        partition.consumed++;
        events.push({ subtaskIndex: st.index, partitionIndex: pIdx, offset: partition.consumed - 1 });
        st.cursor = (st.cursor + attempt + 1) % st.assigned.length;
        break;
      }
    }
  });
  return events;
}

function generateConnectorCode(config) {
  if (config.type === "kafka") {
    const posCode = config.startingPosition === "earliest" ? "OffsetsInitializer.earliest()" : "OffsetsInitializer.latest()";
    return `KafkaSource<Order> source = KafkaSource.<Order>builder()
    .setBootstrapServers("kafka-broker:9092")
    .setTopics("${config.name}")
    .setGroupId("orders-consumer-group")
    .setStartingOffsets(${posCode})
    .setValueOnlyDeserializer(new OrderDeserializationSchema())
    .build();

DataStream<Order> orders = env
    .fromSource(source, watermarkStrategy, "kafka-source")
    .setParallelism(${config.parallelism});  // topic has ${config.unitCount} partitions`;
  }

  const posCode = config.startingPosition === "TRIM_HORIZON" ? "InitialPosition.TRIM_HORIZON" : "InitialPosition.LATEST";
  return `Configuration sourceConfig = new Configuration();
sourceConfig.set(KinesisSourceConfigOptions.STREAM_INITIAL_POSITION, ${posCode});

KinesisStreamsSource<Order> source = KinesisStreamsSource.<Order>builder()
    .setStreamArn("arn:aws:kinesis:us-east-1:123456789012:stream/${config.name}")
    .setSourceConfig(sourceConfig)
    .setDeserializationSchema(new OrderDeserializationSchema())
    .build();

DataStream<Order> orders = env
    .fromSource(source, watermarkStrategy, "kinesis-source")
    .setParallelism(${config.parallelism});  // stream has ${config.unitCount} shards`;
}

/** Mission definitions: instructions plus a structural check against the built config. */
const CONNECTOR_MISSIONS = {
  "kafka-replay": {
    title: "Mission: Reprocess Everything",
    scenario:
      "A bug in yesterday's job means some orders were mis-processed. You need to reprocess the entire " +
      "orders topic from the start, using all 3 of its partitions in parallel.",
    goal: [
      "Source type: Kafka",
      "Topic: orders",
      "Starting position: earliest (replay the full backlog)",
      "3 partitions, parallelism 3 (one subtask per partition, nothing idle)",
    ],
    validate(config) {
      if (config.type !== "kafka") return { ok: false, message: "This mission needs a Kafka source." };
      if (config.name !== "orders") return { ok: false, message: 'Topic should be "orders".' };
      if (config.startingPosition !== "earliest") return { ok: false, message: "Starting position should be earliest, to replay the backlog." };
      if (config.unitCount !== 3) return { ok: false, message: "Set 3 partitions." };
      if (config.parallelism !== 3) return { ok: false, message: "Set parallelism to 3, to match the 3 partitions with nothing idle." };
      return { ok: true, message: "Kafka, orders, earliest, 3 partitions ↔ parallelism 3 — run it and watch every partition's backlog drain to zero." };
    },
  },
  "kinesis-live": {
    title: "Mission: Only Live Traffic",
    scenario:
      "A new real-time dashboard should only reflect orders placed from the moment it goes live — the " +
      "existing backlog on the 2-shard orders-stream is old data it shouldn't show.",
    goal: [
      "Source type: Kinesis",
      "Stream name: orders-stream",
      "Starting position: LATEST (skip the existing backlog)",
      "2 shards, parallelism 2",
    ],
    validate(config) {
      if (config.type !== "kinesis") return { ok: false, message: "This mission needs a Kinesis source." };
      if (config.name !== "orders-stream") return { ok: false, message: 'Stream name should be "orders-stream".' };
      if (config.startingPosition !== "LATEST") return { ok: false, message: "Starting position should be LATEST, to skip the existing backlog." };
      if (config.unitCount !== 2) return { ok: false, message: "Set 2 shards." };
      if (config.parallelism !== 2) return { ok: false, message: "Set parallelism to 2, to match the 2 shards." };
      return { ok: true, message: "Kinesis, orders-stream, LATEST, 2 shards ↔ parallelism 2 — run it and notice lag starts (and stays) at zero." };
    },
  },
};
