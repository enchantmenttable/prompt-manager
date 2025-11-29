export function sanitize(value) {
    const div = document.createElement("div");
    div.textContent = value;
    return div.innerHTML.replace(/\n/g, "<br>");
}
