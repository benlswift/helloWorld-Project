async function fetchObjectives() {
  try {
    const response = await fetch(window.GET_OBJECTIVES_API_URL);
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error('Expected an objectives array.');
    }
    if (!data.length) {
      renderObjectives(data, []);
      return;
    }

    const keyResults = await fetchKeyResults();
    renderObjectives(data, keyResults);
  } catch (error) {
    console.error("Failed to fetch objectives:", error);
  }
}

async function fetchKeyResults() {
  const response = await fetch(window.GET_KEY_RESULTS_API_URL);
  if (!response.ok) {
    throw new Error(`Key results request failed: ${response.status}`);
  }
  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('Expected a key results array.');
  }
  return data;
}

function renderObjectives(objectives, keyResults) {
  const tableBody = document.getElementById('okr-table-body');
  tableBody.replaceChildren();

  if (!objectives.length) {
    const row = tableBody.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 3;
    cell.textContent = 'No objectives found.';
    return;
  }

  for (const objective of objectives) {
    if (!objective || typeof objective.Objective !== 'string' ||
        typeof objective.id !== 'string' || !objective.id) {
      throw new Error('Objective is missing its ID or objective text.');
    }

    const matchingResults = keyResults.filter(result => result?.ObjectiveID === objective.id);
    if (matchingResults.some(result => typeof result.Result !== 'string')) {
      throw new Error('Key result is missing its result text.');
    }

    if (!matchingResults.length) {
      const row = tableBody.insertRow();
      const objectiveCell = row.insertCell();
      objectiveCell.textContent = objective.Objective;
      const noResultsCell = row.insertCell();
      noResultsCell.colSpan = 2;
      noResultsCell.textContent = 'No key results found for this objective.';
      continue;
    }

    matchingResults.forEach((result, index) => {
      const row = tableBody.insertRow();
      if (index === 0) {
        const objectiveCell = row.insertCell();
        objectiveCell.rowSpan = matchingResults.length;
        objectiveCell.textContent = objective.Objective;
      }

      const resultCell = row.insertCell();
      resultCell.textContent = result.Result;
      const progressCell = row.insertCell();
      const progress = typeof result.Progress === 'number' && Number.isFinite(result.Progress)
        ? result.Progress
        : 0;

      const progressBox = document.createElement('input');
      progressBox.type = 'number';
      progressBox.min = '0';
      progressBox.max = '100';
      progressBox.step = '1';
      progressBox.value = String(progress);
      progressBox.ariaLabel = `Progress for ${result.Result}`;
      progressBox.style.borderColor = progressColour(progress);

      const saveButton = document.createElement('button');
      saveButton.type = 'button';
      saveButton.textContent = 'Save';

      const saveStatus = document.createElement('span');
      saveStatus.ariaLive = 'polite';

      saveButton.onclick = () => {
        updateKeyResult(result, progressBox, saveButton, saveStatus);
      };

      const progressUnit = document.createElement('span');
      progressUnit.textContent = '% ';

      progressCell.append(progressBox, progressUnit, saveButton, saveStatus);
    });
  }
}

function progressColour(progress) {
  if (progress >= 75) return 'green';
  if (progress >= 50) return 'orange';
  return 'red';
}

async function updateKeyResult(keyResult, progressInput, saveButton, saveStatus) {
  if (!progressInput.value || !progressInput.checkValidity()) {
    progressInput.reportValidity();
    return;
  }
  saveButton.disabled = true;
  saveButton.textContent = 'Saving...';
  saveStatus.textContent = '';
  try {
    const response = await fetch(window.SET_KEY_RESULTS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: keyResult.id,
        ObjectiveID: keyResult.ObjectiveID,
        Progress: Number(progressInput.value),
        Result: keyResult.Result
      })
    });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    const updatedKeyResult = await response.json();
    keyResult.Progress = updatedKeyResult.Progress;
    progressInput.value = String(updatedKeyResult.Progress);
    saveButton.textContent = 'Saved';
  } catch (err) {
    console.error(err);
    saveButton.textContent = 'Save';
    saveStatus.textContent = 'Save failed. Try again.';
  } finally {
    saveButton.disabled = false;
  }
}

// const starterObjectives = [
//   {
//     id: "students",
//     title: "Deliver meaningful and measurable support to GMIoT students through insight sessions.",
//     owner: "Outreach team",
//     initials: "OT",
//     keyResults: [
//       { title: "Run insight sessions for GMIoT students", current: 3, target: 5, unit: "sessions" },
//       { title: "Deliver a BBC facilities tour for students", current: 1, target: 1, unit: "tour" },
//       { title: "Collect positive learning and development feedback", current: 36, target: 80, unit: "responses" },
//       { title: "Signpost BBC career pathways at every event", current: 7, target: 10, unit: "events" }
//     ]
//   },
//   {
//     id: "partnership",
//     title: "Provide industry leadership and partnership support to the GMIoT.",
//     owner: "Partnerships",
//     initials: "PA",
//     keyResults: [
//       { title: "Maintain BBC representation on governance groups", current: 2, target: 2, unit: "groups" },
//       { title: "Support equipment and curriculum decisions", current: 5, target: 9, unit: "requests" },
//       { title: "Amplify GMIoT partnership stories", current: 1, target: 4, unit: "campaigns" }
//     ]
//   },
//   {
//     id: "people",
//     title: "Build opportunities within the BBC for staff development and inter-department relationships.",
//     owner: "People & culture",
//     initials: "PC",
//     keyResults: [
//       { title: "Engage BBC staff across technical areas", current: 8, target: 10, unit: "staff" },
//       { title: "Run cross-department events", current: 1, target: 2, unit: "events" },
//       { title: "Collect beneficial development feedback", current: 28, target: 80, unit: "responses" }
//     ]
//   }
// ];

// let objectives = loadObjectives();
// fetchObjectives();
// let keyResults = loadKeyResults();
// fetchKeyResults();
// const objectivesList = document.querySelector("#objectives-list");
// const statusFilter = document.querySelector("#status-filter");
// const dialog = document.querySelector("#key-result-dialog");
// const resultForm = document.querySelector("#key-result-form");

// function loadObjectives() {
//   try {
//     const saved = JSON.parse(localStorage.getItem(storageKey));
//     if (!Array.isArray(saved) || !saved.length) return starterObjectives;
//     return saved.map((objective) => ({
//       ...objective,
//       keyResults: objective.keyResults.map((result) => result.current !== undefined ? result : {
//         ...result,
//         current: Math.round((result.progress || 0) / 100 * 100),
//         target: 100,
//         unit: "items"
//       })
//     }));
//   } catch (error) {
//     return starterObjectives;
//   }
// }

// function saveObjectives() {
//   localStorage.setItem(storageKey, JSON.stringify(objectives));
// }

// function averageProgress(objective) {
//   if (!objective.keyResults.length) return 0;
//   return Math.round(objective.keyResults.reduce((sum, result) => sum + resultProgress(result), 0) / objective.keyResults.length);
// }

// function resultProgress(result) {
//   return result.target ? Math.min(100, Math.round((result.current / result.target) * 100)) : 0;
// }

// function getStatus(progress) {
//   if (progress >= 100) return { label: "Complete", className: "complete" };
//   if (progress < 50) return { label: "At risk", className: "at-risk" };
//   return { label: "On track", className: "on-track" };
// }

// function render() {
//   const filter = statusFilter.value;
//   const visibleObjectives = objectives.filter((objective) => filter === "all" || getStatus(averageProgress(objective)).className === filter);
//   objectivesList.innerHTML = visibleObjectives.map(renderObjective).join("");
//   updateSummary();
// }

// function renderObjective(objective) {
//   const progress = averageProgress(objective);
//   const status = getStatus(progress);
//   return `<article class="objective-card">
//     <div class="objective-heading">
//       <h3 class="objective-title">${escapeHtml(objective.title)}</h3>
//       <span class="owner"><span class="avatar">${escapeHtml(objective.initials)}</span>${escapeHtml(objective.owner)}</span>
//     </div>
//     <div class="objective-meta"><span class="status status--${status.className}">${status.label}</span><span class="objective-score">${objective.keyResults.filter((result) => resultProgress(result) >= 70).length} / ${objective.keyResults.length} key results on track</span></div>
//     <div class="progress-track" aria-label="Visual progress for ${escapeHtml(objective.title)}"><div class="progress-fill progress-fill--${status.className}" style="width: ${progress}%"></div></div>
//     <div class="key-results">
//       ${objective.keyResults.map((result, index) => renderKeyResult(objective.id, result, index)).join("")}
//       <button class="add-result" data-action="add-result" data-objective="${objective.id}" type="button">+ Add key result</button>
//     </div>
//   </article>`;
// }

// function renderKeyResult(objectiveId, result, index) {
//   return `<div class="kr-row">
//     <div class="kr-topline"><div><p class="kr-title">${escapeHtml(result.title)}</p><p class="kr-target">Target: ${result.target} ${escapeHtml(result.unit)}</p></div>
//       <div class="kr-actions"><input class="progress-input" data-action="progress" data-objective="${objectiveId}" data-result="${index}" type="number" min="0" max="${result.target}" value="${result.current}" aria-label="Current value for ${escapeHtml(result.title)}"><span class="kr-percent">${result.current} / ${result.target} ${escapeHtml(result.unit)}</span><button class="delete-result" data-action="delete-result" data-objective="${objectiveId}" data-result="${index}" type="button" aria-label="Remove ${escapeHtml(result.title)}">×</button></div>
//     </div>
//   </div>`;
// }

// function updateSummary() {
//   const allResults = objectives.flatMap((objective) => objective.keyResults);
//   const onTrack = allResults.filter((result) => resultProgress(result) >= 70).length;
//   const complete = allResults.filter((result) => resultProgress(result) >= 100).length;
//   document.querySelector("#overall-progress").textContent = `${onTrack} / ${allResults.length}`;
//   document.querySelector("#objective-count").textContent = objectives.length;
//   document.querySelector("#on-track-count").textContent = `${complete} / ${allResults.length}`;
// }

// function escapeHtml(value) {
//   return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" })[character]);
// }

// objectivesList.addEventListener("input", (event) => {
//   if (event.target.dataset.action !== "progress") return;
//   const objective = objectives.find((item) => item.id === event.target.dataset.objective);
//   objective.keyResults[Number(event.target.dataset.result)].current = Math.max(0, Number(event.target.value));
//   saveObjectives();
//   render();
// });

// objectivesList.addEventListener("click", (event) => {
//   const button = event.target.closest("button");
//   if (!button) return;
//   const objective = objectives.find((item) => item.id === button.dataset.objective);
//   if (button.dataset.action === "add-result") {
//     document.querySelector("#result-objective").value = objective.id;
//     resultForm.reset();
//     document.querySelector("#result-objective").value = objective.id;
//     dialog.showModal();
//   }
//   if (button.dataset.action === "delete-result") {
//     objective.keyResults.splice(Number(button.dataset.result), 1);
//     saveObjectives();
//     render();
//   }
// });

// resultForm.addEventListener("submit", (event) => {
//   event.preventDefault();
//   const objective = objectives.find((item) => item.id === document.querySelector("#result-objective").value);
//   objective.keyResults.push({ title: document.querySelector("#result-title").value, target: Number(document.querySelector("#result-target").value), current: 0, unit: "items" });
//   saveObjectives();
//   dialog.close();
//   resultForm.reset();
//   render();
// });

fetchObjectives();
