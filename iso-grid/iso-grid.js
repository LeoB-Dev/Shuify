for (let i=0; i < 10; i++) {
    const newSquare = document.createElement("div");
    newSquare.classList.add('row');
    const gridContainer = document.getElementById("grid-container");
    gridContainer.appendChild(newSquare);
}

for (let i=0; i < 10; i++) {
    const rowElement = document.getElementsByClassName("row");
    for (let i=0; i < 10; i++) {
        const newCell = document.createElement("div");
        newCell.classList.add('cell');
        rowElement[i].appendChild(newCell);
    }
}

const dropZones = document.getElementsByClassName("dropzone");

document.body.addEventListener("dragstart", (e) => {
    if (e.target.id === "cell") {
        e.target.classList.add("dragging");
        console.log("dragging started");
    }
});

document.body.addEventListener("dragend", (e) => {
    if (e.target.id === "cell") {
        e.target.classList.remove("dragging");
        console.log("dragging ended");
    }
});
