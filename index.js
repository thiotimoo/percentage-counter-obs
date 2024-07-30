const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;
const countersDir = path.join(__dirname, 'data');
const percentagesDir = path.join(countersDir, 'percentages');

// Ensure the counters and percentages directories exist
if (!fs.existsSync(countersDir)) {
    fs.mkdirSync(countersDir);
}
if (!fs.existsSync(percentagesDir)) {
    fs.mkdirSync(percentagesDir);
}

// Middleware to parse JSON bodies
app.use(express.json());
// Serve static files (HTML, CSS, JS)
app.use(express.static('public'));

// Helper function to get counter value from a file
function getCounterValue(filePath) {
    if (fs.existsSync(filePath)) {
        return parseInt(fs.readFileSync(filePath, 'utf8'), 10) || 0;
    }
    return 0;
}

// Helper function to update percentage files
function updatePercentageFiles(counters) {
    let totalCount = 386;

    // Calculate total count
    // Object.keys(counters).forEach(label => {
    //     totalCount += counters[label].count;
    // });

    // Update percentage files
    Object.keys(counters).forEach(label => {
        const percentage = totalCount > 0 ? ((counters[label].count / totalCount) * 100).toFixed(1) : 0;
        fs.writeFileSync(path.join(percentagesDir, `${label}.txt`), percentage.toString(), 'utf8');
    });
}

// API route to get all counters with percentages
app.get('/api/counters', (req, res) => {
    fs.readdir(countersDir, (err, files) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to read counters directory' });
        }
        const counters = {};
        let totalCount = 386;

        // Read all counters and calculate total count
        files.forEach(file => {
            const label = path.basename(file, '.txt');
            if (label !== 'percentages') { // Skip the 'percentages' directory
                const value = getCounterValue(path.join(countersDir, file));
                counters[label] = {
                    count: value,
                    percentage: 0 // Initialize percentage
                };
                // totalCount += value;
            }
        });

        // Calculate percentages
        if (totalCount > 0) {
            Object.keys(counters).forEach(label => {
                counters[label].percentage = ((counters[label].count / totalCount) * 100).toFixed(2);
            });
        }

        // Update percentage files
        updatePercentageFiles(counters);

        res.json(counters);
    });
});

// API route to get a specific counter value with percentage
app.get('/api/counters/:label', (req, res) => {
    const { label } = req.params;
    const filePath = path.join(countersDir, `${label}.txt`);
    const counters = {};

    // Read all counters to calculate total count
    fs.readdir(countersDir, (err, files) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to read counters directory' });
        }
        let totalCount = 0;

        // Calculate total count
        files.forEach(file => {
            const lbl = path.basename(file, '.txt');
            if (lbl !== 'percentages') { // Skip the 'percentages' directory
                const value = getCounterValue(path.join(countersDir, file));
                counters[lbl] = value;
                totalCount += value;
            }
        });

        // Calculate the value and percentage for the requested label
        const counter = getCounterValue(filePath);
        const percentage = totalCount > 0 ? ((counter / totalCount) * 100).toFixed(2) : 0;

        if (counter !== undefined) {
            res.json({ label, count: counter, percentage });
        } else {
            res.status(404).json({ error: 'Counter not found' });
        }
    });
});

// API route to increment a specific counter
app.post('/api/counters/:label/increment', (req, res) => {
    const { label } = req.params;
    const filePath = path.join(countersDir, `${label}.txt`);
    let counter = getCounterValue(filePath);
    counter++;
    fs.writeFileSync(filePath, counter.toString(), 'utf8');

    // Update percentages after increment
    const counters = {};
    counters[label] = { count: counter };
    updatePercentageFiles(counters);

    res.json({ label, count: counter });
});

// API route to decrement a specific counter
app.post('/api/counters/:label/decrement', (req, res) => {
    const { label } = req.params;
    const filePath = path.join(countersDir, `${label}.txt`);
    let counter = getCounterValue(filePath);
    counter--;
    fs.writeFileSync(filePath, counter.toString(), 'utf8');

    // Update percentages after decrement
    const counters = {};
    counters[label] = { count: counter };
    updatePercentageFiles(counters);

    res.json({ label, count: counter });
});

// API route to create a new counter label
app.post('/api/counters/new', (req, res) => {
    const { label } = req.body;
    if (!label) {
        return res.status(400).json({ error: 'Label is required' });
    }

    const filePath = path.join(countersDir, `${label}.txt`);
    if (fs.existsSync(filePath)) {
        return res.status(400).json({ error: 'Label already exists' });
    }

    fs.writeFileSync(filePath, '0', 'utf8'); // Initialize new counter with 0

    // Update percentages after creating a new counter
    const counters = {};
    counters[label] = { count: 0 };
    updatePercentageFiles(counters);

    res.json({ label, count: 0 });
});

// API route to rename a counter label
app.post('/api/counters/rename', (req, res) => {
    const { oldLabel, newLabel } = req.body;
    if (!oldLabel || !newLabel) {
        return res.status(400).json({ error: 'Both old and new labels are required' });
    }

    const oldFilePath = path.join(countersDir, `${oldLabel}.txt`);
    const newFilePath = path.join(countersDir, `${newLabel}.txt`);

    if (!fs.existsSync(oldFilePath)) {
        return res.status(404).json({ error: 'Old label not found' });
    }

    if (fs.existsSync(newFilePath)) {
        return res.status(400).json({ error: 'New label already exists' });
    }

    // Rename the counter file
    fs.renameSync(oldFilePath, newFilePath);

    // Update percentages after renaming a counter
    const counters = {};
    counters[newLabel] = { count: getCounterValue(newFilePath) };
    updatePercentageFiles(counters);

    res.json({ oldLabel, newLabel });
});

// API route to delete a specific counter
app.delete('/api/counters/:label', (req, res) => {
    const { label } = req.params;
    const filePath = path.join(countersDir, `${label}.txt`);
    const percentageFilePath = path.join(percentagesDir, `${label}.txt`);

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        if (fs.existsSync(percentageFilePath)) {
            fs.unlinkSync(percentageFilePath);
        }
        res.json({ message: `Counter '${label}' deleted` });
    } else {
        res.status(404).json({ error: 'Counter not found' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Counter app listening at http://localhost:${port}`);
});
