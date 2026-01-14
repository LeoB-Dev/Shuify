$.get("../navbar.html", function (data) {
    $("#nav").replaceWith(data);
});

// function windowWallPos(e) {
//     e.style.left = "35%";
//     e.style.top = "20%";
// }

// function artWallPos(e) {
//     e.style.left = "30%";
//     e.style.top = "17%";
// }

// function tvWallPos(e) {
//     e.style.left = "30%";
//     e.style.top = "20%";
// }

// function roomLeftDropNScale(e) {
//     e.classList.add('dropped');
//     console.log('child element appended to left dropzone');
//     e.setAttribute("style", "transform: scaleY(1.157) skew(30deg) rotate(30deg);");
//     e.setAttribute("src", e.src.replace("-rev.png", ".png"));
//     e.style.position = "fixed";
// }

// function roomRightDropNScale(e) {
//     e.classList.add('dropped');
//     e.setAttribute("style", "transform: scaleY(1.157) skew(30deg) rotate(-90deg);");
//     console.log('child element appended to right dropzone');
//     e.setAttribute("src", e.src.replace(".png", "-rev.png")); 
//     e.style.position = "fixed";
// }

// function roomBottomDropNScale(e) {
//     e.classList.add('dropped');
//     e.setAttribute("style", "transform: scaleY(1.157) skew(30deg) rotate(-210deg);"); 
//     e.style.position = "fixed";
// }

// function saveState() {
//     const positions = {};
//     document.querySelectorAll('.furniture').forEach(item => {
//         positions[item.id] = item.parentElement.id; // create key value pair
//     });
//     localStorage.setItem('dragPositions', JSON.stringify(positions));
// }


// if (draggedElement.classList.contains("bottom-deny") && (zone.id === "room-right" || zone.id === "room-left" || zone.classList.contains("furn-container"))) {
//     e.preventDefault();
//     zone.classList.add("drag-over");
// } else if (draggedElement.classList.contains("leftright-deny") && (zone.id === "room-bottom" || zone.classList.contains("furn-container"))) {
//     e.preventDefault();
//     zone.classList.add("drag-over");
// }


// window.addEventListener('load', () => {
//     const positions = JSON.parse(localStorage.getItem('dragPositions')) || {};
//     for (const [id, parent] of Object.entries(positions)) {
//         const element = document.getElementById(id);
//         const parentElement = document.getElementById(parent);
//         if (parentElement) {
//             parentElement.appendChild(element);
//             addIsoStyles(parentElement, element);
//         }
//     }
// });


// function showSidebar() {
//     const sidebar = document.querySelector('.sidebar');
//     sidebar.style.display = 'flex';

//     const mainNavItems = document.querySelectorAll('.hideOnMobile');
//     for (const navItem of mainNavItems) {
//         navItem.style.display = 'none';
//     }
// }

// function hideSidebar() {
//     const sidebar = document.querySelector('.sidebar');
//     sidebar.style.display = 'none';

//     const mainNavItems = document.querySelectorAll('.hideOnMobile');
//     for (const navItem of mainNavItems) {
//         navItem.style.display = 'flex';
//     }
// }



/*Credit for saveState and restoreState is  https://blog.pixelfreestudio.com/advanced-techniques-for-using-html5-drag-and-drop/*/

// New e.client style code

const dropZones = document.getElementsByClassName("dropzone");
const furniture = document.getElementsByClassName("furniture");





