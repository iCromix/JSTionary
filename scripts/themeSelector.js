const currentTheme = localStorage.getItem('theme');
if (!currentTheme) {
    currentTheme = "light-theme";
}
document.querySelector('#theme-link').setAttribute('href', `./styles/${currentTheme}.css`);