const toggleDarkMode = () => {
    const isDark = localStorage.getItem('dark');
    document.body.className = isDark ? '' : 'dark-mode';
    localStorage.setItem('dark', isDark ? '' : '1');
    checkDarkMode();
}
const checkDarkMode = () => {
    const isDark = localStorage.getItem('dark');
    const darkModeButton = document.querySelector('.dark-mode-button');
    if (isDark) {
        document.body.className = "dark-mode";
        darkModeButton.innerHTML = '<i class="gg-sun"></i>';
    } else {
        document.body.className = "";
        darkModeButton.innerHTML = '<i class="gg-moon"></i>';
    }
}
document.addEventListener("DOMContentLoaded", function () {
    checkDarkMode();
});