$.get("../navbar.html", function(data){
    $("#nav").replaceWith(data);
});


// CodePen drag and drop version (need to change room elements to id's not classes), thus I am temporarily only selecting this class https://codepen.io/BitsPls/pen/XWvwVpE
const dropZones = document.getElementsByClassName("dropzone");

function roomLeftDropNScale (e){
    e.classList.add('dropped');
    e.setAttribute("style", "transform: scaleY(1.157) skew(30deg) rotate(30deg);");
    e.style.left = "35%";
    e.style.top = "10%";
}

function roomRightDropNScale (e){
    e.classList.add('dropped');
    e.setAttribute("style", "transform: scaleY(1.157) skew(30deg) rotate(-90deg);");
    e.style.left = "35%";
    e.style.top = "10%";   
}

function roomBottomDropNScale (e){
    e.classList.add('dropped');
    e.setAttribute("style", "transform: scaleY(1.157) skew(30deg) rotate(-210deg);");  // 1 / 0.864, you need to divide by 0.864 which is the same as multipling by 1 / 0.864
    e.style.left = "20%";
    e.style.top = "20%";
}


for (const zone of dropZones) {
    zone.addEventListener("dragover", (e) => {
        e.preventDefault(); // Parentheses invoke function - browsers default to not allowing elements to be drop targets
        zone.classList.add("drag-over");
        console.log('started drag-over');
    });

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

            if (zone.id === "room-bottom") {
                console.log('child element appended to bottom dropzone');
                roomBottomDropNScale(draggedElement);
            }

            else if (zone.id === "room-left") {
                if (draggedElement.id === "iso-window") {
                    console.log('child element appended to left dropzone');
                    draggedElement.setAttribute("src", "iso-window.png");
                    roomLeftDropNScale(draggedElement);
                } else {
                    console.log('child element appended to left dropzone');
                    roomLeftDropNScale(draggedElement);
                }
            }

            else if (zone.id === "room-right") {
                if (draggedElement.id === "iso-window") {
                    console.log('child element appended to right dropzone');
                    draggedElement.setAttribute("src", "iso-window-rev.png");
                    roomRightDropNScale(draggedElement);
                } else if (draggedElement.classList.contains("leftright-deny")){
                    console.log('leftright-deny initiated');
                    // zone.classList.remove("dragging");
                }
            }

            else if (zone.classList.contains("furn-container") && zone.classList.contains("dropzone")) {
                console.log('child element appended to furn-container');
                draggedElement.classList.add('dropped');
                draggedElement.setAttribute("style", "transform: none;");
            }
        }
    });
}

document.body.addEventListener("dragstart", (e) => {
    if (e.target.classList.contains("furniture")) {
        e.target.classList.add("dragging");
        console.log("dragging started");
    }
});

document.body.addEventListener("dragend", (e) => {
    if (e.target.classList.contains("furniture")) {
        e.target.classList.remove("dragging");
        console.log("dragging ended");
    }
});



function showSidebar(){
    const sidebar = document.querySelector('.sidebar');
    sidebar.style.display = 'flex';

    const mainNavItems = document.querySelectorAll('.hideOnMobile');
    for (const navItem of mainNavItems) {
        navItem.style.display = 'none';
    }
}

function hideSidebar(){
    const sidebar = document.querySelector('.sidebar');
    sidebar.style.display = 'none';
    
    const mainNavItems = document.querySelectorAll('.hideOnMobile');
    for (const navItem of mainNavItems) {
        navItem.style.display = 'flex';
    }
}



