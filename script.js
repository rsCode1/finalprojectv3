// Initialize the jSuites calendar
// Initialize the jSuites calendar
// Initialize the jSuites calendar
window.onload = function () {
    console.log("Initializing jSuites calendar...");

    jSuites.calendar(document.getElementById('calendar'), {
        type: 'year-month-picker',
        format: 'MMM-YYYY',
        value: '2023-10-01', // Set the default value to October 2023
        onchange: function (instance, value) {
            console.log("Calendar changed. New value: ", value);
            updateHiddenSelectors(value);
            loadData(); // Load data when the month is selected
        }
    });

    console.log("Initializing year and month selectors...");
    loadYearMonthSelectors();
    
    console.log("Loading data on initial page load...");
    loadData(); // Load data on initial page load
};

function updateHiddenSelectors(calendarValue) {
    // Extract the year and month from the full date
    const date = new Date(calendarValue);
    const year = date.getFullYear();
    const monthIndex = date.getMonth() + 1; // getMonth() returns 0-based index, so add 1

    // Update hidden selectors with the selected year and month
    document.getElementById('year').value = year;
    document.getElementById('month').value = monthIndex;

    // Debugging logs
    console.log(`Year set to: ${year}`);
    console.log(`Month set to: ${monthIndex}`);
}


function loadYearMonthSelectors() {
    const currentYear = new Date().getFullYear();
    const years = document.getElementById('year');
    const months = document.getElementById('month');

    // Populate year selector
    for (let year = currentYear - 5; year <= currentYear; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        years.appendChild(option);
    }

    // Populate month selector
    for (let i = 1; i <= 12; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = new Date(0, i - 1).toLocaleString('en', { month: 'short' });
        months.appendChild(option);
    }
}

function loadData() {
    const year = document.getElementById('year').value;
    const month = document.getElementById('month').value;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = monthNames[month - 1];
    const filename = `${monthName}-${year}.xlsx`;

    console.log(`Attempting to fetch file: ${filename}`); // Log the filename for debugging

    fetch(filename)
        .then(response => {
            if (!response.ok) {
                console.log('No corresponding data found for:', filename); // Log the error
                alert('No corresponding data found');
                d3.select("#combined-chart").html("");
                d3.select("#fitness-chart").html("");
                d3.select("#parkinsons-chart").html("");
                d3.select("#polar-plot").html("");
                return;
            } else {
                return response.arrayBuffer();
            }
        })
        .then(buffer => {
            if (buffer) {
                const data = new Uint8Array(buffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const allData = processWorkbook(workbook); // Process data and return it
                createAllCharts(allData); // Create all charts using the processed data
            }
        })
        .catch(error => console.error('Error loading Excel file:', error));
}





function processWorkbook(workbook) {
    const allData = [];
    workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        json.forEach(d => {
            const dateStr = String(d.Date);
            const dateParts = dateStr.split('.');
            if (dateParts.length !== 3) return;
            const date = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`);

            const hours = Math.floor(d.Time * 24);
            const minutes = Math.round((d.Time * 24 - hours) * 60);
            const timeFormatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

            allData.push({
                ...d,
                month: sheetName,
                date: date,
                time: timeFormatted,
                dofiker: +d.dofiker || 0,
                sinment: +d.sinment || 0,
                fitness_level: +d['fitness level'] || 0,
                parkinsons_level: +d['Parkinson level'] || 0,
                leg_cramps: +d['Leg cramps'] || 0,
                leg_cramps_time: +d['Leg cramps time'] || 0
            });
        });
    });
    return allData; // Return processed data
}
function createAllCharts(data) {
    createCombinedChart(data); // Create the combined chart
    showDailyCharts(data[0].date.toISOString().split('T')[0], data); // Create the daily charts using the first date as default
    //createPolarPlot(data); // Create the polar plot
}
document.getElementById('load-data').addEventListener('click', loadData);
loadYearMonthSelectors();

function calculateDailyAverages(data) {
    const fitnessAverages = {};
    const parkinsonsAverages = {};

    data.forEach(d => {
        const dateKey = d.date.toISOString().split('T')[0];

        if (d.fitness_level !== 0 && d.parkinsons_level !== 0) {
            // 如果这一天还没有出现在平均值对象中，则初始化
            if (!fitnessAverages[dateKey]) {
                fitnessAverages[dateKey] = { sum: 0, count: 0 };
            }
            if (!parkinsonsAverages[dateKey]) {
                parkinsonsAverages[dateKey] = { sum: 0, count: 0 };
            }

            // 更新总和和计数
            fitnessAverages[dateKey].sum += d.fitness_level;
            fitnessAverages[dateKey].count++;
            parkinsonsAverages[dateKey].sum += d.parkinsons_level;
            parkinsonsAverages[dateKey].count++;
        }
    });

    Object.keys(fitnessAverages).forEach(key => {
        fitnessAverages[key] = parseFloat((fitnessAverages[key].sum / fitnessAverages[key].count).toFixed(2));
    });

    Object.keys(parkinsonsAverages).forEach(key => {
        parkinsonsAverages[key] = parseFloat((parkinsonsAverages[key].sum / parkinsonsAverages[key].count).toFixed(2));
    });

    return { fitnessAverages, parkinsonsAverages };
}

function createCombinedChart(data) {
    const container = d3.select("#combined-chart");
    const width = container.node().getBoundingClientRect().width - 250; // Subtract padding
    const height = 300; // You can adjust this value
    const margin = { top: 50, right: 50, bottom: 100, left: 80 };

    const { fitnessAverages, parkinsonsAverages } = calculateDailyAverages(data);

    data.forEach(d => {
        const dateKey = d.date.toISOString().split('T')[0];
        d.fitnessAvg = fitnessAverages[dateKey] || 0;
        d.parkinsonsAvg = parkinsonsAverages[dateKey] || 0;
        // console.log('fitnessAvg', d.fitnessAvg)
    })

    // console.log(data);

    const svg = d3.select("#combined-chart")
        .html("")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Aggregate data by date for total medication intake
    const aggregatedData = d3.rollup(
        data,
        v => d3.sum(v, d => d.dofiker),
        d => d.date.toISOString().split('T')[0]
    );

    const dates = Array.from(aggregatedData.keys());
    const dailyTotals = Array.from(aggregatedData.values());

    const dateExtent = d3.extent(dates);
    const dateRangeText = `${dateExtent[0]} - ${dateExtent[1]}`;

    const x = d3.scaleBand()
        .domain(dates)
        .range([0, width])
        .padding(0.2);

    const y = d3.scaleLinear()
        .domain([
            0,
            d3.max([
                d3.max(data, d => Math.max(d.parkinsons_level, d.fitness_level)),
                d3.max(dailyTotals)
            ])
        ])
        .range([height, 0]);

    // Draw Fitness and Parkinson's Levels Bar Charts
    svg.selectAll(".bar-fitness")
        .data(data)
        .enter().append("rect")
        .attr("class", "bar-fitness")
        .attr("x", d => x(d.date.toISOString().split('T')[0]))
        .attr("y", d => y(d.fitnessAvg))
        .attr("width", x.bandwidth() / 2)
        .attr("height", d => height - y(d.fitnessAvg))
        .attr("fill", "green")
        .on("mouseover", function (event, d) {
            d3.select("#tooltip")
                .style("opacity", 1)
                .html(`Date: ${d.date.toISOString().split('T')[0]}<br>Fitness Level: ${d.fitnessAvg}`)
                .style("left", (event.pageX + 5) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function () {
            d3.select("#tooltip").style("opacity", 0);
        })
        .on("click", function (event, d) {
            const dateString = d.date.toISOString().split('T')[0];
            showDailyCharts(dateString, data);
        });

    svg.selectAll(".bar-parkinsons")
        .data(data)
        .enter().append("rect")
        .attr("class", "bar-parkinsons")
        .attr("x", d => x(d.date.toISOString().split('T')[0]) + x.bandwidth() / 2)
        .attr("y", d => y(d.parkinsonsAvg))
        .attr("width", x.bandwidth() / 2)
        .attr("height", d => height - y(d.parkinsonsAvg))
        .attr("fill", "blue")
        .on("mouseover", function (event, d) {
            d3.select("#tooltip")
                .style("opacity", 1)
                .html(`Date: ${d.date.toISOString().split('T')[0]}<br>Parkinson's Level: ${d.parkinsonsAvg}`)
                .style("left", (event.pageX + 5) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function () {
            d3.select("#tooltip").style("opacity", 0);
        })
        .on("click", function (event, d) {
            const dateString = d.date.toISOString().split('T')[0];
            showDailyCharts(dateString, data);
        });

    // Draw Medication Intake Line Chart
    const line = d3.line()
        .x((d, i) => x(dates[i]) + x.bandwidth() / 2)
        .y(d => y(d))
        .curve(d3.curveLinear); // Use a linear curve

    svg.append("path")
        .datum(dailyTotals)
        .attr("fill", "none")
        .attr("stroke", "red")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5, 5") // Set the dash pattern
        .attr("d", line);

    svg.selectAll(".dot")
        .data(dailyTotals)
        .enter().append("circle")
        .attr("class", "dot")
        .attr("cx", (d, i) => x(dates[i]) + x.bandwidth() / 2)
        .attr("cy", d => y(d))
        .attr("r", 3)
        .attr("fill", "red")
        .on("mouseover", function (event, d, i) {
            d3.select("#tooltip")
                .style("opacity", 1)
                .html(`Date: ${dates[i]}<br>Medication Intake: ${d}`)
                .style("left", (event.pageX + 5) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function () {
            d3.select("#tooltip").style("opacity", 0);
        })
        .on("click", function (event, d, i) {
            showDailyCharts(data.filter(e => e.date.toISOString().split('T')[0] === dates[i]));
        });
    // Add X axis
    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end");

    // Add Y axis (left)
    svg.append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(y));

    // Add title
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .attr("class", "chart-title")
        .style("font-size", "14px")
        .text(`Daily Average Parkinson and Fitness Levels with Medicine Intake (${dateRangeText})`);

    // Add legend
    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width / 2 - 100},${height + 50})`);

    legend.append("rect")
        .attr("x", 0)
        .attr("y", 25)
        .attr("width", 10)
        .attr("height", 10)
        .attr("fill", "green");

    legend.append("text")
        .attr("x", 20)
        .attr("y", 35)
        .text("Fitness Level");

    legend.append("rect")
        .attr("x", 100)
        .attr("y", 25)
        .attr("width", 10)
        .attr("height", 10)
        .attr("fill", "blue");

    legend.append("text")
        .attr("x", 120)
        .attr("y", 35)
        .text("Parkinson's Level");

    legend.append("rect")
        .attr("x", 224)
        .attr("y", 25)
        .attr("width", 10)
        .attr("height", 10)
        .attr("fill", "red");

    legend.append("text")
        .attr("x", 240)
        .attr("y", 35)
        .text("Medication Intake");

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom / 1.5)
        .attr("text-anchor", "middle")
        .text("Data");
    // 添加竖直显示的文本
    svg.append("text")
        .attr("x", -height / 2) // 调整x坐标使文本位于左侧y轴的左侧
        .attr("y", -margin.left + 10) // 调整y坐标使文本更靠近y轴
        .attr("transform", "rotate(-90)") // 旋转文本90度使其竖直显示
        .attr("dy", ".71em") // 调整基线以使文本居中
        .attr("text-anchor", "middle")
        .text("Average Level");

    // Add the container element after the chart is created
    const containerCombined = d3.select("#combined-chart")
        .append("div")
        .attr("class", "container")
        .style("display", "none") // Hide until data is loaded
        .append("aside")
        .attr("class", "more-info")
        .append("span")
        .attr("class", "tooltiptext")
        .text("Enter the tooltip message here.");
    const dateSelector = d3.select("#date-selector");
    dateSelector.html(""); // Clear previous options
    dates.forEach(date => {
        dateSelector.append("option")
            .attr("value", date)
            .text(date);
    });

    dateSelector.on("change", function () {
        const selectedDate = this.value;
        updateChartsForDate(selectedDate, data);
    });

}
let data = []; // Initialize data variable

function updateChartsForDate(selectedDate, data) {
    if (!data) {
        console.error("Data is undefined.");
        return;
    }
    const filteredData = data.filter(d => d.date.toISOString().split('T')[0] === selectedDate);
    if (filteredData.length === 0) {
        console.warn("No data found for the selected date.");
    }
    showDailyCharts(selectedDate, data);
}
const allDates = Array.from(new Set(data.map(d => {
    const dateStr = d.date.toISOString().split('T')[0];
    return dateStr;
})));

function showDailyCharts(date, data) {

    if (!data) {
        console.error("Data is undefined.");
        return;
    }

    const filteredData = data.filter(d => d.date.toISOString().split('T')[0] === date);
    if (filteredData.length === 0) {
        console.warn("No data found for the selected date.");
    }

    validFitnessData = filteredData.filter(d => d['fitness_level'] > 0);
    fitnessAvg = validFitnessData.length > 0 ? d3.mean(validFitnessData, d => d['fitness_level']).toFixed(2) : 0;

    validParkinsonsData = filteredData.filter(d => d['parkinsons_level'] > 0);
    parkinsonsAvg = validParkinsonsData.length > 0 ? d3.mean(validParkinsonsData, d => d['parkinsons_level']).toFixed(2) : 0;

    createBarChart(filteredData, 'fitness_level', 'Fitness Levels', '#fitness-chart', allDates, fitnessAvg, parkinsonsAvg);
    createBarChart(filteredData, "parkinsons_level", "Parkinson's_level", "#parkinsons-chart", allDates, fitnessAvg, parkinsonsAvg);
    createCombinedChart(data, fitnessAvg, parkinsonsAvg)
    createPolarPlot(filteredData);
}

function createBarChart(data, key, title, selector) {
    const width = 500, height = 140;
    const margin = { top: 50, right: 50, bottom: 50, left: 50 };

    const text1 = title + " on " + data[0].date.toISOString().split('T')[0];

    updateChart(data);

    function updateChart(filteredData) {
        d3.select(selector).select("svg").remove(); // Clear previous SVG

        const svg = d3.select(selector)
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scaleBand()
            .domain(filteredData.map(d => d.time))
            .range([0, width])
            .padding(0.1);

        const y = d3.scaleLinear()
            .domain([0, 5])
            .range([height, 0]);

        svg.selectAll(".bar")
            .data(filteredData)
            .enter().append("rect")
            .attr("class", "bar")
            .attr("x", d => x(d.time))
            .attr("y", d => y(d[key]))
            .attr("width", x.bandwidth())
            .attr("height", d => height - y(d[key]))
            .attr("fill", key === "fitness_level" ? "green" : "blue")
            .on("mouseover", function (event, d) {
                d3.select("#tooltip")
                    .style("opacity", 1)
                    .html(`Time: ${d.time}<br>${key === "fitness_level" ? 'Fitness Level' : 'Parkinson\'s Level'}: ${d[key]}`)
                    .style("left", (event.pageX + 5) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function () {
                d3.select("#tooltip").style("opacity", 0);
            });

        if (key === 'fitness_level') {
            svg.append("text")
                .attr("x", width / 10)
                .attr("y", height + margin.bottom - 8)
                .attr("text-anchor", "middle")
                .attr("alignment-baseline", "middle") // 确保文本垂直居中
                .style("font-size", "14px")
                .style("font-weight", "bold")
                .text(`Avg: ${fitnessAvg}`);
        }

        if (key === 'parkinsons_level') {
            svg.append("text")
                .attr("x", width / 10)
                .attr("y", height + margin.bottom - 8)
                .attr("text-anchor", "middle")
                .attr("alignment-baseline", "middle")
                .style("font-size", "14px")
                .style("font-weight", "bold")
                .text(`Avg: ${parkinsonsAvg}`);
        }

        svg.append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0, ${height})`)
            .call(d3.axisBottom(x))
            .selectAll("text")
            .attr("transform", "rotate(-45)")
            .style("text-anchor", "end");

        svg.append("g")
            .attr("class", "y-axis")
            .call(d3.axisLeft(y));

        svg.append("text")
            .attr("x", width / 2)
            .attr("y", -10)
            .attr("text-anchor", "middle")
            .attr("class", "chart-title")
            .style("font-size", "14px")
            .text(text1);

        svg.append("text")
            .attr("x", width / 2)
            .attr("y", height + margin.bottom)
            .attr("text-anchor", "middle")
            .text("Time");

        svg.append("text")
            .attr("x", -height / 2)
            .attr("y", -margin.left + 5)
            .attr("transform", "rotate(-90)")
            .attr("dy", ".71em")
            .attr("text-anchor", "middle")
            .text(title);
    }

    if (key === 'fitness_level') {
        const container1 = d3.select("#fitness-chart")
            .append("div")
            .attr("class", "container")
            .style("display", "block") // Hide until data is loaded
            .append("aside")
            .attr("class", "more-info")
            .append("span")
            .attr("class", "tooltiptext")
            .text("Enter the tooltip message here.");
    }
    if (key === 'parkinsons_level') {
        const container2 = d3.select("#parkinsons-chart")
            .append("div")
            .attr("class", "container")
            .style("display", "block") // Hide until data is loaded
            .append("aside")
            .attr("class", "more-info")
            .append("span")
            .attr("class", "tooltiptext")
            .text("Enter the tooltip message here.");
    }
}

function createPolarPlot(data) {
    const container = d3.select("#polar-plot");
    const width = container.node().getBoundingClientRect().width - 40; // Subtract padding
    const height = width;
    const margin = { top: 50, right: 50, bottom: 50, left: 50 };

    const svg = d3.select("#polar-plot")
        .html("")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${width / 2 + margin.left},${height / 2 + margin.top})`);

    const radius = Math.min(width, height) / 2;

    // Adjusted angle scale so 0-hour (midnight) is at the top
    const angle = d3.scaleTime()
        .domain([new Date(data[0].date).setHours(0, 0, 0, 0), new Date(data[0].date).setHours(24, 0, 0, 0)])
        .range([-Math.PI / 2, 1.5 * Math.PI]);

    // Invert the domain of r so that values closer to 0 are plotted closer to the center.
    // Adjust the range to start from radius / 5 to ensure the minimum non-zero value is further away from the center.
    const r = d3.scaleLinear()
        .domain([d3.max(data, d => Math.max(d.dofiker, d.sinment)), 0])
        .range([radius / 5, radius]);

    // Draw background circles without labels
    svg.selectAll(".polar-circle")
        .data(r.ticks(5))
        .enter().append("circle")
        .attr("class", "polar-circle")
        .attr("r", d => r(d))
        .attr("fill", "none")
        .attr("stroke", "#ccc");

    // Draw radial grid lines
    svg.selectAll(".polar-line")
        .data(angle.ticks(24))
        .enter().append("line")
        .attr("class", "polar-line")
        .attr("x1", 0)
        .attr("y", 0)
        .attr("x2", d => radius * Math.cos(angle(d)))
        .attr("y2", d => radius * Math.sin(angle(d)))
        .attr("stroke", "#ccc");

    // Add clock labels (0-23) with 0 at the top
    svg.selectAll(".clock-label")
        .data(d3.range(24))
        .enter().append("text")
        .attr("class", "clock-label")
        .attr("x", d => (radius + 15) * Math.cos(angle(new Date(data[0].date).setHours(d, 0, 0, 0))))
        .attr("y", d => (radius + 15) * Math.sin(angle(new Date(data[0].date).setHours(d, 0, 0, 0))))
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "middle")
        .style("font-size", "10px")
        .text(d => d);

    // Plot `dofiker` points
    svg.selectAll(".dofiker-dot")
        .data(data.filter(d => d.dofiker > 0)) // Filter out 0 values
        .enter().append("circle")
        .attr("class", "dofiker-dot")
        .attr("cx", d => {
            // Set the minimum non-zero value to a radius of radius / 5
            const adjustedRadius = d.dofiker > 0 ? r(d.dofiker) : radius / 5;
            return adjustedRadius * Math.cos(angle(new Date(d.date).setHours(...d.time.split(':'))));
        })
        .attr("cy", d => {
            const adjustedRadius = d.dofiker > 0 ? r(d.dofiker) : radius / 5;
            return adjustedRadius * Math.sin(angle(new Date(d.date).setHours(...d.time.split(':'))));
        })
        .attr("r", 4)
        .attr("fill", "red")
        .on("mouseover", function (event, d) {
            d3.select("#tooltip")
                .style("opacity", 1)
                .html(`Time: ${d.time}<br>Dofiker: ${d.dofiker}`)
                .style("left", (event.pageX + 5) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function () {
            d3.select("#tooltip").style("opacity", 0);
        });

    // Plot `sinment` points
    svg.selectAll(".sinment-dot")
        .data(data.filter(d => d.sinment > 0)) // Filter out 0 values
        .enter().append("circle")
        .attr("class", "sinment-dot")
        .attr("cx", d => {
            const adjustedRadius = d.sinment > 0 ? r(d.sinment) : radius / 5;
            return adjustedRadius * Math.cos(angle(new Date(d.date).setHours(...d.time.split(':'))));
        })
        .attr("cy", d => {
            const adjustedRadius = d.sinment > 0 ? r(d.sinment) : radius / 5;
            return adjustedRadius * Math.sin(angle(new Date(d.date).setHours(...d.time.split(':'))));
        })
        .attr("r", 4)
        .attr("fill", "blue")
        .on("mouseover", function (event, d) {
            d3.select("#tooltip")
                .style("opacity", 1)
                .html(`Time: ${d.time}<br>Sinment: ${d.sinment}`)
                .style("left", (event.pageX + 5) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function () {
            d3.select("#tooltip").style("opacity", 0);
        });

    svg.append("text")
        .attr("x", 0)
        .attr("y", -radius - 25)
        .attr("text-anchor", "middle")
        .attr("class", "chart-title")
        .style("font-size", "14px")
        .text(`Medicine Intake on ${data[0].date.toISOString().split('T')[0]}`);

    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${-width / 2 + 20},${radius + 20})`);

    const legendBox = legend.selectAll(".legend-box")
        .data([
            { color: "red", label: "Dofiker" },
            { color: "blue", label: "Sinment" }
        ])
        .enter().append("g")
        .attr("class", "legend-box")
        .attr("transform", (d, i) => `translate(0, ${i * 20})`);

    legendBox.append("rect")
        .attr("width", 12)
        .attr("height", 12)
        .attr("fill", d => d.color);

    legendBox.append("text")
        .attr("x", 20)
        .attr("y", 10)
        .text(d => d.label);

    const containerPolarPlot = d3.select("#polar-plot")
        .append("div")
        .attr("class", "container")
        .style("display", "block") // Hide until data is loaded
        .append("aside")
        .attr("class", "more-info")
        .append("span")
        .attr("class", "tooltiptext")
        .text("Enter the tooltip message here.");
}

