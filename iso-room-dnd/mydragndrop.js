const item = document.querySelector("#player");
const gridBottom = document.querySelector(".tile-bottom");

let currentMouseX = 0;
let currentMouseY = 0;
let offsetX = 0;
let offsetY = 0;
let activeItem = null;
let lastSlot = null;
let activeSlot = null;

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

item.addEventListener("mousedown", function (event) {
    activeItem = item;
    lastSlot = item.parentNode;

    offsetX = event.offsetX;
    offsetY = event.offsetY;

    item.style.position = "absolute";
    document.body.appendChild(item);

    item.style.left = `${event.clientX - offsetX}px`;
    item.style.top = `${event.clientY - offsetY}px`;
})