let cnfmPasswd = document.querySelector("#cnfm-passwd").value;
let passwd = document.querySelector("#passwd").value;

if (cnfmPasswd != passwd) {
    alert("Passwords don't match!");
}