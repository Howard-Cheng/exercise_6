// Constants to easily refer to pages
const SPLASH = document.querySelector(".splash");
const PROFILE = document.querySelector(".profile");
const LOGIN = document.querySelector(".login");
const ROOM = document.querySelector(".room");

// Custom validation on the password reset fields
const passwordField = document.querySelector(".profile input[name='password']");
const repeatPasswordField = document.querySelector(".profile input[name='repeatPassword']");

passwordField.addEventListener("input", checkPasswordRepeat);
repeatPasswordField.addEventListener("input", checkPasswordRepeat);

function checkPasswordRepeat() {
    if (passwordField.value === repeatPasswordField.value) {
        repeatPasswordField.setCustomValidity("");
    } else {
        repeatPasswordField.setCustomValidity("Passwords don't match");
    }
}

// Page load handler
document.addEventListener("DOMContentLoaded", function () {
    navigateBasedOnURL();
    setupEventListeners();
});

function navigateBasedOnURL() {
    const path = window.location.pathname;
    const isAuthenticated = localStorage.getItem("apiKey") !== null;

    hideAllPages();

    if (path === "/" || path === "/splash") {
        SPLASH.style.display = isAuthenticated ? "none" : "block";
        if (isAuthenticated) navigateTo("/profile");
    } else if (path === "/login") {
        LOGIN.style.display = isAuthenticated ? "none" : "block";
    } else if (path.startsWith("/profile") && isAuthenticated) {
        PROFILE.style.display = "block";
    } else if (path.startsWith("/room") && isAuthenticated) {
        ROOM.style.display = "block";
        const roomId = path.split("/")[2]; // Assuming path format is "/room/{roomId}"
        startPollingForMessages(roomId);
    } else {
        navigateTo("/login");
    }
}

function hideAllPages() {
    SPLASH.style.display = "none";
    PROFILE.style.display = "none";
    LOGIN.style.display = "none";
    ROOM.style.display = "none";
}

function navigateTo(page) {
    history.pushState({}, "", page);
    navigateBasedOnURL();
}

// Handling clicks on UI elements
function setupEventListeners() {
    // Example: Logout button
    document.querySelector(".logout").addEventListener("click", function () {
        localStorage.removeItem("apiKey");
        navigateTo("/login");
    });

    // Add more event listeners for login, signup, room creation, etc.
}

// Handling login
function loginUser(username, password) {
    fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
    })
        .then((response) => response.json())
        .then((data) => {
            if (data.api_key) {
                localStorage.setItem("apiKey", data.api_key);
                navigateTo("/profile");
            } else {
                alert("Login failed");
            }
        });
}

// Handling signup
function signupUser(username, password) {
    fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
    })
        .then((response) => response.json())
        .then((data) => {
            if (data.api_key) {
                localStorage.setItem("apiKey", data.api_key);
                navigateTo("/profile");
            } else {
                alert("Signup failed");
            }
        });
}

// Start polling for new messages in a room
let pollingInterval;

function startPollingForMessages(roomId) {
    stopPollingForMessages(); // Ensure any existing polling is stopped first

    pollingInterval = setInterval(() => {
        fetch(`/api/room/${roomId}/messages`, {
            headers: { Authorization: localStorage.getItem("apiKey") },
        })
            .then((response) => response.json())
            .then((messages) => {
                // Update the ROOM with new messages
                // Implement message display logic here
            });
    }, 500); // Poll every 0.5 seconds
}

function stopPollingForMessages() {
    if (pollingInterval) clearInterval(pollingInterval);
}

function createRoom() {
    const roomName = prompt("Enter the new room name:");
    if (!roomName) return; // Exit if no name is entered

    fetch("/api/room/create", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: localStorage.getItem("apiKey"),
        },
        body: JSON.stringify({ name: roomName }),
    })
        .then((response) => response.json())
        .then((data) => {
            if (data.success) {
                alert("Room created successfully");
                navigateTo("/room/" + data.roomId); // Adjust based on your API response
            } else {
                alert("Failed to create room");
            }
        });
}

function renameRoom(roomId) {
    const newName = prompt("Enter the new room name:");
    if (!newName) return; // Exit if no new name is entered

    fetch(`/api/room/${roomId}/rename`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: localStorage.getItem("apiKey"),
        },
        body: JSON.stringify({ newName }),
    })
        .then((response) => response.json())
        .then((data) => {
            if (data.success) {
                alert("Room renamed successfully");
                navigateTo("/room/" + roomId); // Refresh the room
            } else {
                alert("Failed to rename room");
            }
        });
}

function postMessage(roomId) {
    const messageContent = document.querySelector("#messageInput").value; // Adjust selector as needed
    if (!messageContent) return; // Exit if no message content

    fetch(`/api/room/${roomId}/message`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: localStorage.getItem("apiKey"),
        },
        body: JSON.stringify({ message: messageContent }),
    })
        .then((response) => response.json())
        .then((data) => {
            if (data.success) {
                alert("Message posted successfully");
                document.querySelector("#messageInput").value = ""; // Clear the input field
                startPollingForMessages(roomId); // Optionally refresh messages immediately
            } else {
                alert("Failed to post message");
            }
        });
}
