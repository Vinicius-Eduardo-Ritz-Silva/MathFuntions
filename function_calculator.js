$(document).ready(function() {
    let functionChart = null;

    // Mathematical symbol insertion
    $('.math-symbol').click(function() {
        var symbol = $(this).data('symbol');
        var $input = $(this).closest('.input-group').find('input');
        var currentValue = $input.val();
        $input.val(currentValue + symbol);
        $input.focus();
    });

    // Function to help with symbol conversion for math.js
    function preprocessFunction(func) {
        try {
            // Basic normalization
            func = func.trim()
                .replace(/\s+/g, '')  // Remove all whitespace
                .replace(/,/g, '.')   // Replace comma with dot for decimal
                
                // Comprehensive power notation handling
                .replace(/([a-zA-Z0-9])\^\(([^)]+)\)/g, 'pow($1, $2)')  // x^(2+1) → pow(x, 2+1)
                .replace(/([a-zA-Z0-9])\^([0-9.]+)/g, 'pow($1, $2)');  // x^2 → pow(x, 2)

            // Explicit multiplication handling
            func = func
                // Handle implicit multiplication
                .replace(/([0-9])x/g, '$1*x')  // 2x → 2*x
                .replace(/([0-9])\(/g, '$1*(')  // 2( → 2*(
                .replace(/\)\(/g, ')*(')   // )( → )*(
                .replace(/([a-zA-Z])([0-9])/g, '$1*$2');  // x2 → x*2

            // Validate the function can be parsed
            math.parse(func);
            
            return func;
        } catch (error) {
            console.error('Preprocessing error:', error);
            console.error('Original function:', func);
            throw new Error(`Erro ao processar função: Verifique a expressão matemática`);
        }
    }

    // Enhanced error handling function
    function safeEvaluate(func, x) {
        try {
            // Preprocess the function
            const processedFunc = preprocessFunction(func);
            
            // Evaluate the function
            const result = math.evaluate(processedFunc, {x: x});
            
            // Additional checks
            if (result === Infinity || result === -Infinity) {
                throw new Error('Resultado infinito');
            }
            
            if (isNaN(result)) {
                throw new Error('Resultado não é um número');
            }
            
            return result;
        } catch (error) {
            console.error('Evaluation error:', error);
            throw error;
        }
    }

    // Function to toggle parameter inputs based on function type
    $('#functionType').change(function() {
        var selectedType = $(this).val();
        if (selectedType === 'linear') {
            $('#linearParams').show();
            $('#quadraticParams').hide();
        } else {
            $('#linearParams').hide();
            $('#quadraticParams').show();
        }
    });

    // Calculate button click event
    $('#calculateBtn').click(function() {
        var functionType = $('#functionType').val();
        var x = parseFloat($('#xValue').val());
        var result;

        if (functionType === 'linear') {
            var a = parseFloat($('#linearA').val());
            var b = parseFloat($('#linearB').val());
            result = a * x + b;
        } else {
            var a = parseFloat($('#quadraticA').val());
            var b = parseFloat($('#quadraticB').val());
            var c = parseFloat($('#quadraticC').val());
            result = a * x * x + b * x + c;
        }

        // Validate inputs
        if (isNaN(x) || 
            (functionType === 'linear' && (isNaN(a) || isNaN(b))) || 
            (functionType === 'quadratic' && (isNaN(a) || isNaN(b) || isNaN(c)))) {
            $('#result').html('<div class="alert alert-danger">Por favor, preencha todos os campos corretamente.</div>');
        } else {
            $('#result').html(`<div class="alert alert-success">f(${x}) = ${result.toFixed(2)}</div>`);
        }
    });

    // Limit calculation button
    $('#calculateLimitBtn').click(function() {
        var originalFunc = $('#limitFunction').val();
        var point = parseFloat($('#limitPoint').val());
        var approach = $('#limitApproach').val();

        try {
            // Validate inputs
            if (!originalFunc || isNaN(point)) {
                throw new Error('Por favor, preencha todos os campos corretamente.');
            }

            // Function to calculate limit by approaching from different sides
            function calculateLimit(side) {
                const epsilon = side === 'positive' ? 1e-10 : -1e-10;
                const limitPoint = point + epsilon;

                // Use safeEvaluate with the original function
                return safeEvaluate(originalFunc.replace(/x/g, `(${limitPoint})`), limitPoint);
            }

            let result;
            switch(approach) {
                case 'positive':
                    result = calculateLimit('positive');
                    break;
                case 'negative':
                    result = calculateLimit('negative');
                    break;
                case 'both':
                    const leftLimit = calculateLimit('negative');
                    const rightLimit = calculateLimit('positive');
                    
                    // Check if limits are approximately equal
                    result = Math.abs(leftLimit - rightLimit) < 1e-8 ? leftLimit : 'Indefinido';
                    break;
            }

            // Display result
            $('#limitResult').html(`
                <div class="alert alert-success">
                    <strong>Limite:</strong> 
                    ${result !== 'Indefinido' ? result.toFixed(4) : result}
                    <br>
                    <small>Aproximação para x → ${point}</small>
                </div>
            `);
        } catch (error) {
            $('#limitResult').html(`<div class="alert alert-danger">Erro: ${error.message}</div>`);
        }
    });

    // Graph plotting button
    $('#plotGraphBtn').click(function() {
        // Get the original function input
        var originalFunc = $('#graphFunction').val();
        var xMin = parseFloat($('#xMin').val());
        var xMax = parseFloat($('#xMax').val());

        // Validate input range
        if (isNaN(xMin) || isNaN(xMax)) {
            $('#graphResult').html(`<div class="alert alert-danger">Por favor, insira um intervalo de x válido.</div>`);
            return;
        }

        if (xMin >= xMax) {
            $('#graphResult').html(`<div class="alert alert-danger">O valor mínimo de x deve ser menor que o valor máximo.</div>`);
            return;
        }

        try {
            // Destroy previous chart if exists
            if (functionChart) {
                functionChart.destroy();
            }

            // Validate and preprocess the function
            var processedFunc = preprocessFunction(originalFunc);

            // Generate data points
            var validPoints = [];
            var errorPoints = [];

            // Use a smaller step for more precise plotting
            var step = Math.max(0.1, (xMax - xMin) / 200);

            for (var x = xMin; x <= xMax; x += step) {
                try {
                    // Evaluate the function for each x
                    var y = math.evaluate(processedFunc, {x: x});

                    // Check for valid numeric value
                    if (typeof y === 'number' && isFinite(y)) {
                        validPoints.push({x: x, y: y});
                    } else {
                        errorPoints.push({x: x, reason: 'Valor inválido'});
                    }
                } catch (evalError) {
                    // Log and track points that couldn't be evaluated
                    errorPoints.push({
                        x: x, 
                        reason: evalError.message
                    });
                    console.warn(`Pulando x = ${x}: ${evalError.message}`);
                }
            }

            // Ensure we have points to plot
            if (validPoints.length === 0) {
                throw new Error('Não foi possível plotar a função. Verifique a expressão matemática.');
            }

            // Create chart
            var ctx = document.getElementById('functionGraph').getContext('2d');
            functionChart = new Chart(ctx, {
                type: 'line',
                data: {
                    datasets: [{
                        label: `f(x) = ${originalFunc}`,
                        data: validPoints,
                        borderColor: 'blue',
                        backgroundColor: 'rgba(0, 0, 255, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        pointRadius: 3,
                        pointHoverRadius: 5
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: `Gráfico de f(x) = ${originalFunc}`
                        }
                    },
                    scales: {
                        x: {
                            type: 'linear',
                            position: 'bottom',
                            title: {
                                display: true,
                                text: 'x'
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: 'f(x)'
                            }
                        }
                    }
                }
            });

            // Show success message
            $('#graphResult').html(`
                <div class="alert alert-success">
                    <strong>Gráfico plotado com sucesso!</strong>
                    <br>Função: f(x) = ${originalFunc}
                    <br>Pontos plotados: ${validPoints.length}
                    ${errorPoints.length > 0 ? `<br>Pontos com erro: ${errorPoints.length}` : ''}
                </div>
            `);

            // Log any error points
            if (errorPoints.length > 0) {
                console.warn('Pontos com erro durante plotagem:', errorPoints);
            }
        } catch (error) {
            $('#graphResult').html(`
                <div class="alert alert-danger">
                    <strong>Erro ao plotar gráfico:</strong>
                    <br>${error.message}
                </div>
            `);
            console.error('Erro completo na plotagem:', error);
        }
    });
});
