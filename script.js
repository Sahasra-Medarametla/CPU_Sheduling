const processColors = ["P1", "P2", "P3", "P4", "P5"];

function createTable() {
    const count = +document.getElementById('processCount').value;
    let html = '<table><tr><th>PID</th><th>Arrival</th><th>Burst</th><th>Priority</th></tr>';
    for (let i = 0; i < count; i++) {
        html += `<tr>
            <td>P${i + 1}</td>
            <td><input type="number" min="0" id="arrival${i}" value="${i}"></td>
            <td><input type="number" min="1" id="burst${i}" value="5"></td>
            <td><input type="number" min="1" id="priority${i}" value="${i + 1}"></td>
        </tr>`;
    }
    html += '</table>';
    document.getElementById('inputTable').innerHTML = html;
    html += `</table>
    <div class="summary">
        <div>Average WT: ${avgWT}</div>
        <div>Average TAT: ${avgTAT}</div>
    </div>`;

}

document.getElementById('algorithm').addEventListener('change', function() {
    document.getElementById('quantumLabel').style.display = 
        this.value === 'RR' ? 'inline-block' : 'none';
});

function simulate() {
    const count = +document.getElementById('processCount').value;
    const algo = document.getElementById('algorithm').value;
    const quantum = +document.getElementById('quantum').value;

    let processes = [];
    for (let i = 0; i < count; i++) {
        processes.push({
            pid: "P" + (i + 1),
            arrival: +document.getElementById('arrival' + i).value,
            burst: +document.getElementById('burst' + i).value,
            priority: +document.getElementById('priority' + i).value,
        });
    }

    let result;
    switch (algo) {
        case "FCFS": result = fcfs(processes); break;
        case "SJF": result = sjf(processes); break;
        case "PRIORITY": result = priority(processes); break;
        case "RR": result = rr(processes, quantum); break;
    }
    renderGantt(result.timeline);
    renderResults(processes, result);
}

function fcfs(processes) {
    let order = processes.slice().sort((a, b) => a.arrival - b.arrival);
    let time = 0, timeline = [];
    let stats = processes.map(p => ({wait: 0, tat: 0}));
    for (let i = 0; i < order.length; i++) {
        time = Math.max(time, order[i].arrival);
        stats[i].wait = time - order[i].arrival;
        time += order[i].burst;
        stats[i].tat = time - order[i].arrival;
        timeline.push({pid: order[i].pid, start: time - order[i].burst, end: time});
    }
    return {stats, timeline};
}

function sjf(processes) {
    let procs = processes.slice();
    let time = Math.min(...procs.map(p => p.arrival)), timeline = [], done = [];
    while (done.length < procs.length) {
        let ready = procs.filter(p => !done.includes(p) && p.arrival <= time);
        if (ready.length === 0) {
            time++;
            continue;
        }
        let next = ready.reduce((a, b) => a.burst < b.burst ? a : b);
        let idx = procs.indexOf(next);
        let start = Math.max(time, next.arrival);
        let wait = start - next.arrival;
        let end = start + next.burst;
        timeline.push({pid: next.pid, start, end});
        done.push(next);
        procs[idx]._wait = wait;
        procs[idx]._tat = end - next.arrival;
        time = end;
    }
    let stats = procs.map(p => ({wait: p._wait, tat: p._tat}));
    return {stats, timeline};
}

function priority(processes) {
    let procs = processes.slice();
    let time = Math.min(...procs.map(p => p.arrival)), timeline = [], done = [];
    while (done.length < procs.length) {
        let ready = procs.filter(p => !done.includes(p) && p.arrival <= time);
        if (ready.length === 0) {
            time++;
            continue;
        }
        let next = ready.reduce((a, b) => a.priority < b.priority ? a : b);
        let idx = procs.indexOf(next);
        let start = Math.max(time, next.arrival);
        let wait = start - next.arrival;
        let end = start + next.burst;
        timeline.push({pid: next.pid, start, end});
        done.push(next);
        procs[idx]._wait = wait;
        procs[idx]._tat = end - next.arrival;
        time = end;
    }
    let stats = procs.map(p => ({wait: p._wait, tat: p._tat}));
    return {stats, timeline};
}

function rr(processes, quantum) {
    let queue = [], time = Math.min(...processes.map(p => p.arrival)), left = processes.map(p => p.burst), timeline = [];
    let stats = processes.map(p => ({wait: 0, tat: 0, comp: 0}));
    let arrived = processes.map((p, i) => ({i, time: p.arrival}));
    let active = [];
    while (true) {
        for (let x of arrived) {
            if (x.time <= time && !queue.includes(x.i) && left[x.i] > 0) queue.push(x.i);
        }
        if (queue.length === 0) {
            time++;
            if (left.every(x => x === 0)) break;
            continue;
        }
        let cur = queue.shift();
        let start = time;
        let run = Math.min(left[cur], quantum);
        time += run;
        timeline.push({pid: processes[cur].pid, start, end: time});
        left[cur] -= run;
        for (let x of arrived) {
            if (x.time <= time && !queue.includes(x.i) && left[x.i] > 0 && x.i !== cur) queue.push(x.i);
        }
        if (left[cur] > 0) queue.push(cur);
        else {
            stats[cur].tat = time - processes[cur].arrival;
            stats[cur].comp = time;
        }
    }
    // Calculate waiting time
    for (let i = 0; i < processes.length; i++) {
        stats[i].wait = stats[i].tat - processes[i].burst;
    }
    return {stats, timeline};
}

function renderGantt(timeline) {
    let container = document.getElementById('gantt');
    let html = '<h4>Gantt (blocks side-by-side)</h4>';
    html += '<div class="gantt-bar">';
    timeline.forEach(bar => {
        // Calculate bar width proportional to duration (e.g. 10px per unit)
        let width = (bar.end - bar.start) * 10;
        html += `<div class="bar ${bar.pid}" style="width:${width}px;">
                    ${bar.pid}<span>${bar.start}-${bar.end}</span>
                 </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
}



function renderResults(processes, result) {
    let html = '<table><tr><th>Process</th><th>Arrival</th><th>Burst</th><th>Priority</th><th>Waiting</th><th>Turnaround</th></tr>';
    let totalWT = 0, totalTAT = 0;
    processes.forEach((p, i) => {
        html += `<tr>
            <td>${p.pid}</td>
            <td>${p.arrival}</td>
            <td>${p.burst}</td>
            <td>${p.priority}</td>
            <td>${result.stats[i].wait}</td>
            <td>${result.stats[i].tat}</td>
        </tr>`;
        totalWT += result.stats[i].wait;
        totalTAT += result.stats[i].tat;
    });
    let n = processes.length;
    let avgWT = (totalWT / n).toFixed(2);
    let avgTAT = (totalTAT / n).toFixed(2);
    html += `</table><div class="summary">Average WT: ${avgWT} &nbsp; Average TAT: ${avgTAT}</div>`;
    document.getElementById('results').innerHTML = html;
}

function clearAll() {
    document.getElementById('inputTable').innerHTML = "";
    document.getElementById('gantt').innerHTML = "";
    document.getElementById('results').innerHTML = "";
}
