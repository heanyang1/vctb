document.addEventListener('DOMContentLoaded', () => {
    // Canvas and context for both matrices
    const canvas1 = document.getElementById('matrixCanvas1');
    const ctx1 = canvas1.getContext('2d');
    const canvas2 = document.getElementById('matrixCanvas2');
    const ctx2 = canvas2.getContext('2d');
    
    // UI elements
    const colorPicker = document.getElementById('colorPicker');
    const loadBtn1 = document.getElementById('loadBtn1');
    const loadBtn2 = document.getElementById('loadBtn2');
    const matrixFile1 = document.getElementById('matrixFile1');
    const matrixFile2 = document.getElementById('matrixFile2');
    const matrixSizeSpan1 = document.getElementById('matrixSize1');
    const matrixSizeSpan2 = document.getElementById('matrixSize2');
    const uniqueValuesSpan = document.getElementById('uniqueValues');
    const inputFileList = document.getElementById('inputFileList');
    const outputFileList = document.getElementById('outputFileList');
    
    // Data storage
    let matrix1 = [];
    let matrix2 = [];
    let allUniqueValues = new Set();
    let colorMap = new Map();
    
    // Default colors for the first few values
    const defaultColors = [
        '#FF0000', // red
        '#00FF00', // green
        '#0000FF', // blue
        '#FFFF00', // yellow
        '#FF00FF', // magenta
        '#00FFFF', // cyan
        '#FFA500', // orange
        '#800080', // purple
        '#008000', // dark green
        '#000080'  // navy
    ];
    
    // Load the matrix file
    async function loadMatrixFile(filename) {
        try {
            const response = await fetch(filename);
            if (!response.ok) {
                throw new Error(`Failed to load ${filename}: ${response.statusText}`);
            }
            const text = await response.text();
            return text;
        } catch (error) {
            console.error('Error loading matrix file:', error);
            alert(`Error loading ${filename}: ${error.message}`);
            return null;
        }
    }
    
    // Parse the matrix from text
    function parseMatrix(text) {
        const lines = text.trim().split('\n');
        return lines.map(line => 
            line.trim().split(/\s+/).map(Number)
        );
    }
    
    // Find unique values in the matrix
    function findUniqueValues(matrix) {
        const values = new Set();
        matrix.forEach(row => row.forEach(val => values.add(val)));
        return Array.from(values).sort((a, b) => a - b);
    }
    
    // Initialize color pickers for each unique value
    function initColorPickers(values) {
        // Only update if the set of values has changed
        const currentValues = new Set(values);
        const sameValues = currentValues.size === colorMap.size && 
                         Array.from(currentValues).every(v => colorMap.has(v));
        
        if (sameValues) return; // No need to update if values are the same
        
        // Preserve existing colors for values that still exist
        const newColorMap = new Map();
        
        // Add existing colors for values that still exist
        values.forEach(value => {
            if (colorMap.has(value)) {
                newColorMap.set(value, colorMap.get(value));
            } else {
                // Assign a new color from the default colors
                const index = [...newColorMap.keys()].length % defaultColors.length;
                newColorMap.set(value, defaultColors[index]);
            }
        });
        
        colorMap = newColorMap;
        
        // Update the color picker UI
        colorPicker.innerHTML = '';
        
        // Sort values for consistent display
        const sortedValues = Array.from(colorMap.keys()).sort((a, b) => a - b);
        
        sortedValues.forEach(value => {
            const colorItem = document.createElement('div');
            colorItem.className = 'color-item';
            
            const label = document.createElement('label');
            label.textContent = `Value ${value}:`;
            
            const input = document.createElement('input');
            input.type = 'color';
            input.value = colorMap.get(value);
            input.className = 'color-swatch';
            input.dataset.value = value;
            input.addEventListener('input', (e) => {
                const val = parseInt(e.target.dataset.value);
                colorMap.set(val, e.target.value);
                redrawAll();
            });
            
            colorItem.appendChild(label);
            colorItem.appendChild(input);
            colorPicker.appendChild(colorItem);
        });
    }
    
    // Draw a matrix on a canvas
    function drawMatrix(matrix, ctx, sizeSpan) {
        if (!matrix || matrix.length === 0 || matrix[0].length === 0) return;
        
        const rows = matrix.length;
        const cols = matrix[0].length;
        
        // Calculate cell size to fit the canvas
        const containerWidth = ctx.canvas.parentElement.clientWidth - 40; // Account for padding
        const cellSize = Math.max(1, Math.min(20, Math.floor(containerWidth / cols)));
        
        // Set canvas size
        ctx.canvas.width = cols * cellSize;
        ctx.canvas.height = rows * cellSize;
        
        // Draw each cell
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const value = matrix[y][x];
                ctx.fillStyle = colorMap.get(value) || '#000000';
                ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }
        
        // Update size info
        if (sizeSpan) {
            sizeSpan.textContent = `${rows} × ${cols}`;
        }
    }
    
    // Redraw both matrices
    function redrawAll() {
        drawMatrix(matrix1, ctx1, matrixSizeSpan1);
        drawMatrix(matrix2, ctx2, matrixSizeSpan2);
        uniqueValuesSpan.textContent = allUniqueValues.size;
    }
    
    // Handle window resize
    window.addEventListener('resize', () => {
        if (matrix1.length > 0 || matrix2.length > 0) {
            redrawAll();
        }
    });
    
    // Update unique values from both matrices
    function updateUniqueValues() {
        allUniqueValues = new Set([
            ...findUniqueValues(matrix1),
            ...findUniqueValues(matrix2)
        ]);
        
        // Initialize or update color pickers
        if (allUniqueValues.size > 0) {
            initColorPickers(Array.from(allUniqueValues).sort((a, b) => a - b));
        }
        
        // Redraw both matrices with updated colors
        redrawAll();
    }
    
    // Load matrix from file
    function loadMatrix(file, targetMatrix, otherMatrix, sizeSpan, ctx) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const fileContent = e.target.result;
                if (fileContent) {
                    targetMatrix.length = 0; // Clear existing matrix
                    targetMatrix.push(...parseMatrix(fileContent));
                    
                    // Just update the matrix, we'll handle drawing and unique values in the main flow
                }
                resolve();
            };
            
            reader.onerror = () => {
                alert('Error reading file');
                resolve();
            };
            
            reader.readAsText(file);
        });
    }
    
    // Single load button click handler
    document.getElementById('loadBtn').addEventListener('click', async () => {
        const file1 = matrixFile1.files[0];
        const file2 = matrixFile2.files[0];
        
        if (!file1 && !file2) {
            alert('Please select at least one matrix file');
            return;
        }
        
        // Show loading state
        const loadBtn = document.getElementById('loadBtn');
        const originalText = loadBtn.textContent;
        loadBtn.textContent = 'Loading...';
        loadBtn.disabled = true;
        
        try {
            // Load both matrices in parallel
            const [result1, result2] = await Promise.all([
                file1 ? loadMatrix(file1, matrix1, matrix2, matrixSizeSpan1, ctx1) : Promise.resolve(),
                file2 ? loadMatrix(file2, matrix2, matrix1, matrixSizeSpan2, ctx2) : Promise.resolve()
            ]);
            
            // Update unique values after both matrices are loaded
            updateUniqueValues();
            
        } catch (error) {
            console.error('Error loading matrices:', error);
            alert('Error loading matrices. Please check the console for details.');
        } finally {
            // Reset button state
            loadBtn.textContent = originalText;
            loadBtn.disabled = false;
        }
    });
    
    // File input change handlers to display selected filenames
    matrixFile1.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            inputFileList.textContent = file.name;
        } else {
            inputFileList.textContent = '';
        }
    });
    
    matrixFile2.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            outputFileList.textContent = file.name;
        } else {
            outputFileList.textContent = '';
        }
    });
});
