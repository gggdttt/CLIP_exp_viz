
  // Data Processing
  function processData(data) {
    var points = []; // Array to store all points
    var humanml3dTexts = new Set(); // Set to store unique humanml3d texts
    var tempBabelTexts = new Set(); // Set to temporarily collect babel texts
  
    // Iterate over the data
    for (var seqKey in data) {
      var sequence = data[seqKey];
      var annotations = sequence.annotations;
      var babelTextsInSequence = [];
  
      // First loop: Collect babel texts
      annotations.forEach(function(annotation) {
        if (annotation.seg_id.startsWith('babel_')) {
          tempBabelTexts.add(annotation.text);
          babelTextsInSequence.push(annotation.text);
        }
      });
  
      // Second loop: Collect humanml3d points
      annotations.forEach(function(annotation) {
        if (annotation.seg_id.startsWith('humanml3d_')) {
          humanml3dTexts.add(annotation.text);
          var point = {
            x: annotation.clip_embedding_2d[0],
            y: annotation.clip_embedding_2d[1],
            humanml3d_text: annotation.text,
            labels: babelTextsInSequence.slice() // Copy of babel texts in this sequence
          };
          points.push(point);
        }
      });
    }
  
    // Convert sets to arrays for dropdowns
    var babelTextList = Array.from(tempBabelTexts);
    var humanml3dTextList = Array.from(humanml3dTexts);
    var babelTextToColor = assignColors(babelTextList);
  
    return { points, babelTextList, humanml3dTextList, babelTextToColor };
  }

  function assignColors(textList) {
    var colorScale = d3.scaleOrdinal(d3.schemeCategory10);
    var textToColor = {};
    textList.forEach(function(text, index) {
        textToColor[text] = colorScale(index);
    });
    return textToColor;
  }


  // Visualization Setup
  function createSvgAndScales(width, height, margin, points) {
    // Find the maximum extent to make scales consistent
    var xExtent = d3.extent(points, function(d) { return d.x; });
    var yExtent = d3.extent(points, function(d) { return d.y; });
    var maxExtent = d3.max([Math.abs(xExtent[0]), Math.abs(xExtent[1]), Math.abs(yExtent[0]), Math.abs(yExtent[1])]);
  
    // Calculate aspect ratio
    var aspectRatio = (height - margin.top - margin.bottom) / (width - margin.left - margin.right);
  
    // Create scales
    var xScale = d3.scaleLinear()
                   .domain([-maxExtent * 1.1, maxExtent * 1.1]) 
                   .range([margin.left, width - margin.right]);
  
    var yScale = d3.scaleLinear()
                   .domain([-maxExtent * 1.1 * aspectRatio, maxExtent * 1.1 * aspectRatio]) 
                   .range([height - margin.bottom, margin.top]);
  
    // Create SVG element
    var svg = d3.select("#embedding_viz")
                .append("svg")
                .attr("width", width)
                .attr("height", height);

    // Create and append x-axis
    var xAxis = d3.axisBottom(xScale).ticks(10);
    svg.append("g")
        .attr("transform", "translate(0," + yScale(0) + ")")  // Position x-axis at y = 0
        .call(xAxis);
        
    // Create and append y-axis
    var yAxis = d3.axisLeft(yScale).ticks(10);
    svg.append("g")
        .attr("transform", "translate(" + xScale(0) + ",0)")  // Position y-axis at x = 0
        .call(yAxis);

    return { svg, xScale, yScale, xAxis, yAxis };
  }

  
  // Tooltip and Dropdown Setup
  function createTooltip() {
    return d3.select("body").append("div")
             .attr("id", "tooltip")
             .style("position", "absolute")
             .style("background-color", "#f0f0f0")
             .style("padding", "5px")
             .style("border", "1px solid #ccc")
             .style("font-size", "12px")
             .style("display", "none");
  }
  
  // Utility function to truncate text if too long
  function truncateText(text, maxLength) {
    if (text.length > maxLength) {
        return text.substring(0, maxLength) + '...';
    }
    return text;
  }

  function createDropdowns(babelTextList, humanml3dTextList) {
    var babelDropdown = d3.select("#babelDropdown").append("select").attr("id", "babelSelect");
    var humanml3dDropdown = d3.select("#humanml3dDropdown").append("select").attr("id", "humanml3dSelect");

    // Add default option to the dropdowns
    babelDropdown.append("option").attr("value", "").text("Select a BABEL text");
    humanml3dDropdown.append("option").attr("value", "").text("Select a HumanML3D text");

    // Max length for the dropdown text
    var maxLength = 100; // Adjust this as needed

    // Populate BABEL text dropdown
    babelDropdown.selectAll("option.babelOption")
                .data(babelTextList)
                .enter()
                .append("option")
                .attr("class", "babelOption")
                .attr("value", function(d) { return d; })
                .text(function(d) { return truncateText(d, maxLength); }) // Truncate long text
                .attr("title", function(d) { return d; }); // Add full text as tooltip

    // Populate HumanML3D text dropdown
    humanml3dDropdown.selectAll("option.humanOption")
                    .data(humanml3dTextList)
                    .enter()
                    .append("option")
                    .attr("class", "humanOption")
                    .attr("value", function(d) { return d; })
                    .text(function(d) { return truncateText(d, maxLength); }) // Truncate long text
                    .attr("title", function(d) { return d; }); // Add full text as tooltip

    return { babelDropdown, humanml3dDropdown };
  }

  // Dropdown Event Handlers
  function setupDropdownHandlers(svg, points, babelTextToColor, babelDropdown, humanml3dDropdown) {
    babelDropdown.on("change", function() {
      var selectedBabelText = this.value;
      d3.select("#humanml3dTexts").text("");  // Clear previous HumanML3D texts
      
      // When a BABEL Text is selected, clear the "Corresponding BABEL Texts"
      d3.select("#babelTexts").text("");
  
      if (selectedBabelText === "") {
        svg.selectAll("circle").attr("fill", "grey");
        return;
      }
  
      var correspondingHumanml3dTexts = points.filter(function(d) {
        return d.labels.includes(selectedBabelText);
      }).map(function(d) {
        return d.humanml3d_text;
      });
  
      correspondingHumanml3dTexts = Array.from(new Set(correspondingHumanml3dTexts)); // Remove duplicates
  
      d3.select("#humanml3dTexts").html("Corresponding HumanML3D Texts:<br>" +
        correspondingHumanml3dTexts.map(function(d) {
          return "<div>" + d + "</div>";
        }).join(""));
  
      svg.selectAll("circle")
         .attr("fill", function(d) {
           if (d.labels.includes(selectedBabelText)) {
             return babelTextToColor[selectedBabelText];
           } else {
             return "transparent";
           }
         });
    });
  
    humanml3dDropdown.on("change", function() {
      var selectedHumanml3dText = this.value;
      d3.select("#babelTexts").text("");  // Clear previous BABEL texts
      
      // When a HumanML3D Text is selected, clear the "Corresponding HumanML3D Texts"
      d3.select("#humanml3dTexts").text("");
  
      if (selectedHumanml3dText === "") {
        svg.selectAll("circle").attr("fill", "grey");
        return;
      }
  
      var correspondingBabelTexts = points.filter(function(d) {
        return d.humanml3d_text === selectedHumanml3dText;
      }).map(function(d) {
        return d.labels;
      });
  
      correspondingBabelTexts = Array.from(new Set([].concat.apply([], correspondingBabelTexts))); // Flatten and remove duplicates
  
      d3.select("#babelTexts").html("Corresponding BABEL Texts:<br>" +
        correspondingBabelTexts.map(function(d) {
        return "<div>" + d + "</div>";
      }).join(""));
  
      svg.selectAll("circle")
         .attr("fill", function(d) {
           if (d.humanml3d_text === selectedHumanml3dText) {
             return "blue";
           } else {
             return "transparent";
           }
         });
    });
  }
  

  // Drawing Points
  function drawPoints(svg, points, xScale, yScale, tooltip) {
    svg.selectAll("circle")
       .data(points)
       .enter()
       .append("circle")
       .attr("cx", function(d) { return xScale(d.x); })
       .attr("cy", function(d) { return yScale(d.y); })
       .attr("r", 5)
       .attr("fill", "grey")
       .on("mouseover", function(event, d) {
          tooltip.style("display", "block");
  
          var correspondingBabelTexts = Array.from(new Set(d.labels)).join(", ");
          var content = `<strong>clip_embedding_2d:</strong> (${d.x.toFixed(2)}, ${d.y.toFixed(2)})<br>` +
                        `<strong>HumanML3D Text:</strong> ${d.humanml3d_text}<br>` +
                        `<strong>Corresponding BABEL Texts:</strong> ${correspondingBabelTexts}`;
  
          tooltip.html(content)
                 .style("left", (event.pageX + 10) + "px")
                 .style("top", (event.pageY - 10) + "px");
       })
       .on("mousemove", function(event) {
          tooltip.style("left", (event.pageX + 10) + "px")
                 .style("top", (event.pageY - 10) + "px");
       })
       .on("mouseout", function() {
          tooltip.style("display", "none");
       });
  }

  // Function to reset all points and clear text
  function showAllPoints(svg, points, babelTextToColor) {
    // Reset all points to their default color
    svg.selectAll("circle")
       .attr("fill", function(d) {
         return babelTextToColor[d.labels[0]] || "grey"; // Use the first label's color or default to grey
       });
  
    // Clear any previously displayed text in the dropdowns
    d3.select("#babelTexts").text("");
    d3.select("#humanml3dTexts").text("");
  }
  

  // Putting It All Together
  d3.json("/assets/data/clean_babel_humanml3d_kitml_embedding.json").then(function(data) {
    // Process data
    var { points, babelTextList, humanml3dTextList, babelTextToColor } = processData(data);
  
    // Set up visualization
    var { svg, xScale, yScale } = createSvgAndScales(800, 600, { top: 20, right: 20, bottom: 60, left: 70 }, points);
  
    // Set up tooltip and dropdowns
    var tooltip = createTooltip();
    var { babelDropdown, humanml3dDropdown } = createDropdowns(babelTextList, humanml3dTextList);
  
    // Draw points
    drawPoints(svg, points, xScale, yScale, tooltip);
  
    // Set up dropdown event handlers
    setupDropdownHandlers(svg, points, babelTextToColor, babelDropdown, humanml3dDropdown);

    // Show all points when the "Show All Points" button is clicked
    d3.select("#showAllPoints").on("click", function() {
    showAllPoints(svg, points, babelTextToColor);
    });
  });
  