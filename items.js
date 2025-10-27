// <?>
var KEY = {
   W: 119,
   A: 97,
   S: 115,
   D: 100
}

var map = {};
map.height = 480;
map.width = 480;

var user = {};
user.deaths = 0;
user.moved = false;
user.element = document.querySelector("*[data-name=joe]");
user.pos = {
   left: 240,
   top: 240
};
user.dragging = false;
user.dragOffset = { x: 0, y: 0 };

setInterval(function() {
   if (user.deaths) document.querySelector(".youdied").textContent = "Suicides: " + user.deaths;
   user.element.style.top = user.pos.top + "px";
   user.element.style.left = user.pos.left + "px";
   user.moved = false;
}, 100);

user.isDead = false;

user.die = function() {
   user.isDead = true;
   setTimeout(function() {
      user.element.classList.add('die');
      setTimeout(function() {
         user.pos = {
            left: 48,
            top: 48
         };
         setTimeout(function() {
            user.deaths++;
            user.element.classList.remove('die');
            user.isDead = false;
         }, 250);
      }, 350);
   }, 250);
};

/* Keyboard Listeners */
document.body.addEventListener("keypress", function(e) {
   if (user.isDead) return;
   var c = e.keyCode;

   if (user.moved) return;

   if (c == KEY.W) {
      if (user.pos.top != 0) {
         user.pos.top -= 48;
         user.moved = true;
      } else {
         user.pos.top -= 48;
         user.die();
      }
   } else if (c == KEY.A) {
      if (user.pos.left != 0) {
         user.pos.left -= 48;
         user.moved = true;
      } else {
         user.pos.left -= 48;
         user.die();
      }
   } else if (c == KEY.S) {
      if (user.pos.top < map.height) {
         user.pos.top += 48;
         user.moved = true;
      } else {
         user.pos.top += 48;
         user.die();
      }
   } else if (c == KEY.D) {
      if (user.pos.left < map.width) {
         user.pos.left += 48;
         user.moved = true;
      } else {
         user.pos.left += 48;
         user.die();
      }
   }
});