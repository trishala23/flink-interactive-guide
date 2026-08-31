/*
 * Tiny quiz engine, driven entirely by data.
 *
 * A module page defines its questions on `window.QUIZ_DATA` before this
 * script runs, and drops an empty `<div id="quiz-root" data-module-id="...">`
 * where the quiz should render:
 *
 *   window.QUIZ_DATA = {
 *     title: "Check your understanding",
 *     questions: [
 *       {
 *         prompt: "...",
 *         options: ["A", "B", "C"],
 *         correct: 1,               // index into options
 *         explain: "Why B is right.",
 *       },
 *     ],
 *   };
 *
 * All correct on "Check answers" marks the module complete (via app.js).
 */

function renderQuiz() {
  const root = document.getElementById("quiz-root");
  if (!root || !window.QUIZ_DATA) return;

  const moduleId = root.getAttribute("data-module-id");
  const data = window.QUIZ_DATA;

  const wrap = document.createElement("div");
  wrap.className = "quiz";

  const heading = document.createElement("h2");
  heading.textContent = data.title || "Check your understanding";
  wrap.appendChild(heading);

  const sub = document.createElement("p");
  sub.className = "sub";
  sub.textContent = "Answer every question, then check your results. Score 100% to mark this module complete.";
  wrap.appendChild(sub);

  data.questions.forEach((q, qi) => {
    const qEl = document.createElement("div");
    qEl.className = "quiz-q";
    qEl.dataset.qi = qi;

    const prompt = document.createElement("p");
    prompt.className = "prompt";
    prompt.textContent = `${qi + 1}. ${q.prompt}`;
    qEl.appendChild(prompt);

    const opts = document.createElement("div");
    opts.className = "quiz-opts";

    q.options.forEach((optText, oi) => {
      const label = document.createElement("label");
      label.className = "quiz-opt";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = `q${qi}`;
      input.value = oi;
      label.appendChild(input);
      const span = document.createElement("span");
      span.textContent = optText;
      label.appendChild(span);
      opts.appendChild(label);
    });

    qEl.appendChild(opts);

    const explain = document.createElement("div");
    explain.className = "quiz-explain";
    explain.textContent = q.explain || "";
    qEl.appendChild(explain);

    wrap.appendChild(qEl);
  });

  const footer = document.createElement("div");
  footer.className = "quiz-footer";

  const btn = document.createElement("button");
  btn.className = "btn btn-primary btn-sm";
  btn.type = "button";
  btn.textContent = "Check answers";

  const score = document.createElement("span");
  score.className = "quiz-score";

  footer.appendChild(btn);
  footer.appendChild(score);
  wrap.appendChild(footer);

  root.replaceWith(wrap);

  btn.addEventListener("click", () => {
    let correctCount = 0;
    let answeredCount = 0;

    data.questions.forEach((q, qi) => {
      const qEl = wrap.querySelector(`.quiz-q[data-qi="${qi}"]`);
      const selected = qEl.querySelector(`input[name="q${qi}"]:checked`);
      qEl.classList.add("checked");
      const optionLabels = qEl.querySelectorAll(".quiz-opt");

      optionLabels.forEach((label, oi) => {
        label.classList.remove("correct", "incorrect");
        if (oi === q.correct) label.classList.add("correct");
        else if (selected && Number(selected.value) === oi) label.classList.add("incorrect");
      });

      if (selected) {
        answeredCount++;
        if (Number(selected.value) === q.correct) correctCount++;
      }
    });

    const total = data.questions.length;
    score.innerHTML = `Score: <strong>${correctCount} / ${total}</strong>`;

    if (answeredCount < total) {
      score.innerHTML += " — answer every question to record a result.";
      return;
    }

    if (correctCount === total && moduleId) {
      setModuleComplete(moduleId);
      score.innerHTML += " 🎉 Module marked complete.";
    } else {
      score.innerHTML += " Review the highlighted answers and try again.";
    }
  });
}

document.addEventListener("DOMContentLoaded", renderQuiz);
