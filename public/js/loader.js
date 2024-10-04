document.addEventListener("DOMContentLoaded", function () {
    // Hide the loader once the content is fully loaded
    const loader = document.getElementById("loader");
    loader.classList.add("hidden");
});

window.addEventListener("beforeunload", function () {
    // Show the loader when the page is unloading
    const loader = document.getElementById("loader");
    loader.classList.remove("hidden");
});