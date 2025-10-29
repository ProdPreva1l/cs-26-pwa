// IndexedDB setup
let db;
const request = indexedDB.open("tasksDB", 1);
request.onupgradeneeded = function(event) {
    db = event.target.result;
    const objectStore = db.createObjectStore("tasks", { keyPath: "id", autoIncrement: true });
    objectStore.createIndex("task", "task", { unique: false });
};
request.onsuccess = function(event) {
    db = event.target.result;
    console.log("IndexedDB initialised successfully");
};
request.onerror = function(event) {
    console.error("Error opening IndexedDB:", event.target.errorCode);
};

// Function to save a task to IndexedDB
function saveTask(task) {
    if (!db) {
        console.error("Database is not initialised");
        return;
    }
    const transaction = db.transaction(["tasks"], "readwrite");
    const objectStore = transaction.objectStore("tasks");
    const request = objectStore.add(task);
    request.onsuccess = function() {
        console.log("Task saved to IndexedDB", task);
    };
    request.onerror = function(event) {
        console.error("Error saving task to IndexedDB:", event.target.errorCode);
    };
}

// Function to retrieve tasks from IndexedDB
function getTasks(callback) {
    if (!db) {
        console.error("Database is not initialised");
        return;
    }
    const transaction = db.transaction(["tasks"], "readonly");
    const objectStore = transaction.objectStore("tasks");
    const tasks = [];
    objectStore.openCursor().onsuccess = function(event) {
        const cursor = event.target.result;
        if (cursor) {
            tasks.push(cursor.value);
            cursor.continue();
        } else {
            callback(tasks);
        }
    };
    transaction.onerror = function(event) {
        console.error("Error retrieving tasks from IndexedDB:", event.target.errorCode);
    };
}