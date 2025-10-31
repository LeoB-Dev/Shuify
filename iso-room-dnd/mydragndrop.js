const item = document.querySelector(".player");
const slots = document.querySelectorAll(".tile-bottom");


let currentMouseX = 0;
let currentMouseY = 0;
let offsetX = 0;
let offsetY = 0;
let activeItem = null;
let lastSlot = null;
let activeSlot = null;

$.get("index.html", function(data){
    $("#nav").replaceWith(data);
});

document.addEventListener("mousemove", function (event) {
    if(activeItem) {
        activeItem.style.left = `${event.clientX - offsetX}px`;
        activeItem.style.top = `${event.clientY - offsetY}px`;

        activeItem.style.display = "none";
        const hoveredElement = document.elementFromPoint(event.clientX, event.clientY);
        activeItem.style.display = "";

        if (hoveredElement && hoveredElement.classList.contains("slot")) {
            activeSlot = hoveredElement;
        } else {
            activeSlot = null;
        }
    }
});

document.addEventListener("mouseup", function () {
    if (activeItem) {
        if (activeSlot) {
            activeSlot.appendChild(activeItem);
        } else if (lastSlot) {
        lastSlot.appendChild(activeItem);
        }

    activeItem.style.position = "relative";
    activeItem.style.left = "0px";
    activeItem.style.top = "0px";
    // activeItem.style.width = "100%";
    // activeItem.style.height = "100%";
    
    activeItem = null;
    activeSlot = null;
    }
});

item.addEventListener("mousedown", function (event) {
    activeItem = item;
    lastSlot = item.parentNode;

    offsetX = event.offsetX;
    offsetY = event.offsetY;

    item.style.position = "absolute";
    document.body.appendChild(item);

    item.style.left = `${event.clientX - offsetX}px`;
    item.style.top = `${event.clientY - offsetY}px`;
});


slots.forEach((slot) => {
    slot.addEventListener("mouseup", function () {
        if (activeItem) {
            slot.appendChild(activeItem);

            activeItem.style.position = "relative";
            activeItem.style.transform = "none";
            activeItem.style.left = "0px";
            activeItem.style.top = "0px";
            // activeItem.style.width = "100%";
            // activeItem.style.height = "100%";

            activeItem = null;
        }
    });
});


function showSidebar(){
    const sidebar = document.querySelector('.sidebar')
    sidebar.style.display = 'flex';
}

function hideSidebar(){
    const sidebar = document.querySelector('.sidebar')
    sidebar.style.display = 'none';
}

