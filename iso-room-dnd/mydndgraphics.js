$.get("../navbar.html", function (data) {
    $("#nav").replaceWith(data);
});

function windowWallPos(e) {
    e.style.left = "35%";
    e.style.top = "20%";
}

function artWallPos(e) {
    e.style.left = "30%";
    e.style.top = "17%";
}

function tvWallPos(e) {
    e.style.left = "30%";
    e.style.top = "20%";
}

function roomLeftDropNScale(e) {
    e.classList.add('dropped');
    console.log('child element appended to left dropzone');
    e.setAttribute("style", "transform: scaleY(1.157) skew(30deg) rotate(30deg);");
    e.setAttribute("src", e.src.replace("-rev.png", ".png"));
    e.style.position = "fixed";
}

function roomRightDropNScale(e) {
    e.classList.add('dropped');
    e.setAttribute("style", "transform: scaleY(1.157) skew(30deg) rotate(-90deg);");
    console.log('child element appended to right dropzone');
    e.setAttribute("src", e.src.replace(".png", "-rev.png")); // replace() doesn't modify the original string — it returns a new string with the replacement. setAttribute does.
    e.style.position = "fixed";
}

function roomBottomDropNScale(e) {
    e.classList.add('dropped');
    e.setAttribute("style", "transform: scaleY(1.157) skew(30deg) rotate(-210deg);");  // 1 / 0.864, you need to divide by 0.864 which is the same as multipling by 1 / 0.864
    e.style.position = "fixed";
}

function saveState() {
    const positions = {};
    document.querySelectorAll('.furniture').forEach(item => {
        positions[item.id] = item.parentElement.id; // create key value pair
    });
    localStorage.setItem('dragPositions', JSON.stringify(positions));
}

function rejectWrongSide() {
    // if class = LeftRIghtDeny 
    // don't allow onto left or right
    // else if class = bottomdeny
    // don't allow onto bottom
}

function addIsoStyles(dropZone, droppedElement) {
    if (dropZone.id === "room-bottom" && droppedElement.id === "iso-bed") {
        console.log('child element appended to bottom dropdropZone');
        roomBottomDropNScale(droppedElement);
        droppedElement.style.left = "20%";
        droppedElement.style.top = "20%";
        saveState();
    }

    else if (dropZone.id === "room-bottom" && droppedElement.id === "iso-couch") {
        console.log('child element appended to bottom dropdropZone');
        roomBottomDropNScale(droppedElement);
        droppedElement.style.left = "20%";
        droppedElement.style.top = "50%";
        saveState();
    }

    else if (dropZone.id === "room-bottom" && droppedElement.id === "iso-desk") {
        console.log('child element appended to bottom dropdropZone');
        roomBottomDropNScale(droppedElement);
        droppedElement.style.left = "50%";
        droppedElement.style.top = "32%";
        saveState();
    }

    else if (dropZone.id === "room-bottom" && droppedElement.id === "iso-chair") {
        console.log('child element appended to bottom dropdropZone');
        roomBottomDropNScale(droppedElement);
        droppedElement.style.left = "60%"; // + = up left, - = down right
        droppedElement.style.top = "50%"; // + = up right, - = down left
        saveState();
    }

    else if (dropZone.id === "room-bottom" && droppedElement.id === "iso-lamp") {
        console.log('child element appended to bottom dropdropZone');
        roomBottomDropNScale(droppedElement);
        droppedElement.style.left = "30%";
        droppedElement.style.top = "65%";
        saveState();
    }


    else if (dropZone.id === "room-left") {
        if (droppedElement.classList.contains("bottom-deny") && droppedElement.id === "iso-art") {
            roomLeftDropNScale(droppedElement);
            artWallPos(droppedElement);
            saveState();
        }

        else if (droppedElement.classList.contains("bottom-deny") && droppedElement.id === "iso-window") {
            roomLeftDropNScale(droppedElement);
            windowWallPos(droppedElement);
            saveState();
        }

        else if (droppedElement.classList.contains("bottom-deny") && droppedElement.id === "iso-tv") {
            roomLeftDropNScale(droppedElement);
            tvWallPos(droppedElement);
            saveState();
        }

        else {
            roomLeftDropNScale(droppedElement);
            saveState();
        }
    }

    else if (dropZone.id === "room-right") {
        if (droppedElement.classList.contains("bottom-deny") && droppedElement.id === "iso-window") {
            roomRightDropNScale(droppedElement);
            windowWallPos(droppedElement);
            saveState();
        }

        else if (droppedElement.classList.contains("bottom-deny") && droppedElement.id === "iso-art") {
            roomRightDropNScale(droppedElement);
            artWallPos(droppedElement);
            saveState();
        }

        else if (droppedElement.classList.contains("bottom-deny") && droppedElement.id === "iso-tv") {
            roomRightDropNScale(droppedElement);
            tvWallPos(droppedElement);
            saveState();
        }

        else if (droppedElement.classList.contains("leftright-deny")) {
            console.log('leftright-deny initiated');
            // dropZone.classList.remove("dragging");
            saveState();
        }
    }


    else if (dropZone.classList.contains("furn-container") && dropZone.classList.contains("dropzone")) {
        console.log('child element appended to furn-container');
        droppedElement.classList.add('dropped');
        droppedElement.setAttribute("style", "transform: none;");
        saveState();
    }
}

const dropZones = document.getElementsByClassName("dropzone");
let draggedElement = null; // declare var in outer scope
// let isDragging = false;

document.body.addEventListener("dragstart", (e) => {
    if (e.target.classList.contains("furniture")) {
        draggedElement = e.target; // update var (e.target can be used for both zone and draggedElement)
        e.target.classList.add("dragging");
        console.log("dragging started");
    }
});

for (const zone of dropZones) {
    zone.addEventListener("dragover", (e) => {
        if (draggedElement.classList.contains("bottom-deny") && (zone.id === "room-right" || zone.id === "room-left" || zone.classList.contains("furn-container"))) {
            e.preventDefault();
            zone.classList.add("drag-over");
        } else if (draggedElement.classList.contains("leftright-deny") && (zone.id === "room-bottom" || zone.classList.contains("furn-container"))) {
            e.preventDefault();
            zone.classList.add("drag-over");
        }
    });

    // Add touch

    zone.addEventListener("dragleave", () => {
        zone.classList.remove("drag-over");
        console.log('removed drag-over');
    });

    zone.addEventListener("drop", (e) => {
        e.preventDefault();
        zone.classList.remove("drag-over");
        console.log('removed drag-over');
        const draggedElement = document.querySelector(".dragging");


        if (draggedElement) {
            zone.appendChild(draggedElement);
            console.log(draggedElement);
            addIsoStyles(zone, draggedElement);
        }
    });
}

window.addEventListener('load', () => {
    const positions = JSON.parse(localStorage.getItem('dragPositions')) || {};
    for (const [id, parent] of Object.entries(positions)) {
        const element = document.getElementById(id);
        const parentElement = document.getElementById(parent);
        if (parentElement) {
            parentElement.appendChild(element);
            addIsoStyles(parentElement, element);
        }
    }
});

document.body.addEventListener("dragend", (e) => {
    if (e.target.classList.contains("furniture")) {
        e.target.classList.remove("dragging");
        console.log("dragging ended");
    }
});

document.body.addEventListener("touchstart", (e) => {
    if (e.target.classList.contains("furniture")) {
        e.target.classList.add("dragging");
        console.log("dragging started");
    }
});

document.body.addEventListener("touchend", (e) => {
    if (e.target.classList.contains("furniture")) {
        e.target.classList.remove("dragging");
        console.log("dragging ended");
    }
});



function showSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.style.display = 'flex';

    const mainNavItems = document.querySelectorAll('.hideOnMobile');
    for (const navItem of mainNavItems) {
        navItem.style.display = 'none';
    }
}

function hideSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.style.display = 'none';

    const mainNavItems = document.querySelectorAll('.hideOnMobile');
    for (const navItem of mainNavItems) {
        navItem.style.display = 'flex';
    }
}



/*Credit for saveState and restoreState is  https://blog.pixelfreestudio.com/advanced-techniques-for-using-html5-drag-and-drop/*/