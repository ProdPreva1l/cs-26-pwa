// Function to get the CSRF token from the cookie
function getCSRFToken() {
    let cookieValue = null;
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.startsWith('csrftoken=')) {
            cookieValue = cookie.substring('csrftoken='.length, cookie.length);
            break;
        }
    }
    console.log("CSRF Token:", cookieValue); // Display the token for debugging
    return cookieValue;
}

document.addEventListener('DOMContentLoaded', function() {
    const addTaskForm = document.querySelector("#taskForm");
    // Initialize IndexedDB when the page loads
    initializeIndexedDB();
    // Load the entire task list on page load
    loadTaskList();
    // Pass the CSRF token to the service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(function(registration) {
            registration.active.postMessage({ csrfToken: getCSRFToken() });
        });
    }
    if (addTaskForm) {
        addTaskForm.addEventListener("submit", function(event) {
            event.preventDefault();
            const task = { name: event.target.elements.task.value };
            if (navigator.onLine) {
                // Send task directly to server if online
                submitTaskToServer(task);
            } else {
                // Save task to IndexedDB and register sync if offline
                saveTask(task);
                registerSync();
            }
        });
    }
});

// Function to fetch the task list from the server and display it
function loadTaskList() {
    if (!navigator.onLine) {
        console.warn("Offline mode detected. Loading tasks from IndexedDB.");
        loadTasksFromIndexedDB();
    } else {
        fetch('api/tasks/')
            .then(response => response.json())
            .then(tasks => {
                const taskList = document.querySelector('#task-list');
                taskList.innerHTML = '';
                tasks.forEach(task => addTaskToPage(task));
            })
            .catch(error => {
                console.error("Failed to load task list from server:", error);
                loadTasksFromIndexedDB(); // Fallback to IndexedDB if server fails
            });
    }
}

// Function to fetch the task list from the IndexedDB and display it
function loadTasksFromIndexedDB() {
    const request = indexedDB.open("tasksDB", 1);
    request.onsuccess = function(event) {
        const db = event.target.result;
        const transaction = db.transaction(["tasks"], "readonly");
        const objectStore = transaction.objectStore("tasks");
        const tasks = [];
        objectStore.openCursor().onsuccess = function(event) {
            const cursor = event.target.result;
            if (cursor) {
                tasks.push(cursor.value);
                cursor.continue();
            } else {
                // Now that tasks are loaded, display them
                const taskList = document.querySelector('#task-list');
                taskList.innerHTML = '';
                tasks.forEach(task => addTaskToPage(task));
            }
        };
    };
    request.onerror = function(event) {
        console.error("IndexedDB error:", event.target.errorCode);
    };
}

// Function to initialise the IndexedDB
function initializeIndexedDB() {
    const request = indexedDB.open("tasksDB", 1);
    // Create object store if it doesn’t exist
    request.onupgradeneeded = function(event) {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("tasks")) {
            db.createObjectStore("tasks", { keyPath: "id", autoIncrement: true });
        }
    };
    request.onerror = function(event) {
        console.error("IndexedDB initialization error:", event.target.errorCode);
    };
}

// Function to send the task to the server
function submitTaskToServer(task) {
    if (!navigator.onLine) {
        // Directly save task to IndexedDB if offline
        console.warn("Offline mode detected. Saving task to IndexedDB for later sync.");
        saveTask(task);
        registerSync();
        return;
    }

    // Determine if this is an update (has an id) or a new task
    const isUpdate = task.id !== undefined;
    const url = isUpdate ? `api/tasks/update/${task.id}/` : 'api/tasks/create/';
    const method = isUpdate ? 'PUT' : 'POST';
    const bodyData = isUpdate ? task : { task: task.name };

    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken() // Include CSRF token if needed
        },
        body: JSON.stringify(bodyData)
    })
    .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        console.log(`Task successfully ${isUpdate ? 'updated on' : 'sent to'} server`);
        return response.json();
    })
    .then(data => {
        console.log("Server response:", data);
        if (!isUpdate) {
            addTaskToPage(data.task); // Add the task to the page only for new tasks
        }
    })
    .catch(error => {
        console.error(`Failed to ${isUpdate ? 'update' : 'send'} task to server:`, error);
        // Save to IndexedDB if a network error occurs
        saveTask(task);
        registerSync();
    });
}

// Function to add a task to the page
function addTaskToPage(task) {
    const taskList = document.querySelector('#task-list');
    const taskElement = document.createElement('li');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.completed;
    checkbox.addEventListener('change', ev => {
        task.completed = ev.currentTarget.checked
        submitTaskToServer(task)
    })

    const label = document.createElement('label');
    label.textContent = task.name;

    taskElement.appendChild(checkbox);
    taskElement.appendChild(label);
    taskList.appendChild(taskElement);
}

// Function to register the sync event with the service worker
function registerSync() {
    navigator.serviceWorker.ready.then(function(registration) {
        registration.sync.register('sync-tasks').then(() => {
            console.log('Sync registered for tasks');
        }).catch(err => {
            console.log('Sync registration failed:', err);
        });
    });
}

// Function to save the task to IndexedDB
function saveTask(task) {
    const request = indexedDB.open("tasksDB", 1);
    request.onsuccess = function(event) {
        const db = event.target.result;
        const transaction = db.transaction(["tasks"], "readwrite");
        const objectStore = transaction.objectStore("tasks");
        objectStore.add(task);
        console.log("Task saved to IndexedDB for offline sync");
    };
    request.onerror = function(event) {
        console.error("Error saving task to IndexedDB:", event.target.errorCode);
    };
}

// Function to sync tasks from IndexedDB to the server when back online
function syncTasksToServer() {
    return new Promise((resolve, reject) => {
        // Open the tasksDB IndexedDB database
        const request = indexedDB.open("tasksDB", 1);
        request.onsuccess = function(event) {
            const db = event.target.result;
            const transaction = db.transaction(["tasks"], "readonly");
            const objectStore = transaction.objectStore("tasks");
            const tasks = [];
            objectStore.openCursor().onsuccess = function(event) {
                const cursor = event.target.result;
                if (cursor) {
                    tasks.push(cursor.value);
                    cursor.continue();
                } else {
                    tasks.forEach(task => {
                        fetch('api/tasks/create/', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-CSRFToken': getCSRFToken()  // Add CSRF token here
                            },
                            body: JSON.stringify(task)
                        }).then(response => {
                            if (response.ok) {
                                // Remove task from IndexedDB after successful sync
                                const deleteTransaction = db.transaction(["tasks"], "readwrite");
                                const deleteStore = deleteTransaction.objectStore("tasks");
                                deleteStore.delete(task.id);
                            }
                        }).catch(error => console.error("Failed to sync task:", error));
                    });
                    resolve();
                }
            };
        };
        request.onerror = function(event) {
            console.error("IndexedDB error:", event.target.errorCode);
            reject();
        };
    });
}