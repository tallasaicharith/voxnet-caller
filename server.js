const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static web app assets
app.use(express.static(__dirname));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(`  VoxNet P2P Online Caller running on port ${PORT}`);
    console.log(`  Open in browser: http://localhost:${PORT}`);
    console.log(`=================================================`);
});
