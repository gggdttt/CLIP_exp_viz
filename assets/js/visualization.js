// Load the data
d3.json("https://raw.githubusercontent.com/gggdttt/CLIP_exp_viz/refs/heads/master/assets/data/clip_data_short.json").then(function(data) {
  // Initialize variables
  var points = []; // Array to store all points
  var babelTexts = new Set(); // Set to store unique babel texts
  var humanml3dTexts = new Set(); // Set to store unique humanml3d texts
  var babelTextToColor = {}; // Mapping from babel text to color
  var babelTextList = []; // List of babel texts for dropdown
  var humanml3dTextList = []; // List of humanml3d texts for dropdown

  // First pass: Collect all babel texts to assign colors
  var tempBabelTexts = new Set();

  // Iterate over the data
  for (var seqKey in data) {
    var sequence = data[seqKey];
    var annotations = sequence.annotations;

    // Within each sequence, collect babel texts and humanml3d points
    var babelTextsInSequence = [];
    annotations.forEach(function(annotation) {
      if (annotation.seg_id.startsWith('babel_')) {
        // It's a babel_XXX annotation
        tempBabelTexts.add(annotation.text);
        babelTextsInSequence.push(annotation.text);
      }
    });

    annotations.forEach(function(annotation) {
      if (annotation.seg_id.startsWith('humanml3d_')) {
        // It's a humanml3d_XXX annotation
        humanml3dTexts.add(annotation.text);

        // Create a point object
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
  
  // Now assign colors to babel texts
  babelTextList = Array.from(tempBabelTexts);
  humanml3dTextList = Array.from(humanml3dTexts);

  var babelColorScale = d3.scaleOrdinal()
                          .domain(babelTextList)
                          .range(d3.schemeCategory10);

  babelTextList.forEach(function(text) {
    babelTextToColor[text] = babelColorScale(text);
  });

  // Now create the visualization
  createVisualization(points, babelTextToColor, babelTextList, humanml3dTextList);
});

function createVisualization(points, babelTextToColor, babelTextList, humanml3dTextList) {
  // Set up SVG dimensions
  var width = 800;
  var height = 600;
  var margin = {top: 20, right: 20, bottom: 30, left: 40};

    // Find the maximum extent to make scales consistent
  var xExtent = d3.extent(points, function(d) { return d.x; });
  var yExtent = d3.extent(points, function(d) { return d.y; });
  var maxExtent = d3.max([Math.abs(xExtent[0]), Math.abs(xExtent[1]), Math.abs(yExtent[0]), Math.abs(yExtent[1])]);

  // Calculate aspect ratio (height to width ratio)
  var aspectRatio = (height - margin.top - margin.bottom) / (width - margin.left - margin.right);

  // Ensure the x and y scales have the same unit length
  var xScale = d3.scaleLinear()
                .domain([-maxExtent * 1.1, maxExtent * 1.1]) // Extend both ends by 10%
                .range([margin.left, width - margin.right]);

  var yScale = d3.scaleLinear()
                .domain([-maxExtent * 1.1 * aspectRatio, maxExtent * 1.1 * aspectRatio]) // Adjust by aspect ratio
                .range([height - margin.bottom, margin.top]);

  // Create SVG element
  var svg = d3.select("#visualization")
              .append("svg")
              .attr("width", width)
              .attr("height", height);

  // Create tooltip element
  var tooltip = d3.select("body").append("div")
  .attr("id", "tooltip")
  .style("position", "absolute")
  .style("background-color", "white")
  .style("padding", "10px")
  .style("border", "1px solid #ccc")
  .style("display", "none")
  .style("pointer-events", "none");  // Prevent mouse interaction

  // Draw points
  svg.selectAll("circle")
     .data(points)
     .enter()
     .append("circle")
     .attr("cx", function(d) { return xScale(d.x); })
     .attr("cy", function(d) { return yScale(d.y); })
     .attr("r", 5)
     .attr("fill", "grey")
     .on("mouseover", function(event, d) {
        // Show tooltip when mouse is over
        tooltip.style("display", "block");

        // Get the corresponding BABEL texts (remove duplicates)
        var correspondingBabelTexts = Array.from(new Set(d.labels)).join(", ");

        // Format the content for the tooltip
        var content = `<strong>clip_embedding_2d:</strong> (${d.x.toFixed(2)}, ${d.y.toFixed(2)})<br>` +
                      `<strong>HumanML3D Text:</strong> ${d.humanml3d_text}<br>` +
                      `<strong>Corresponding BABEL Texts:</strong> ${correspondingBabelTexts}`;
        
        // Update the tooltip content
        tooltip.html(content)
               .style("left", (event.pageX + 10) + "px")  // Position tooltip near the mouse
               .style("top", (event.pageY - 10) + "px");
     })
     .on("mousemove", function(event) {
        // Move the tooltip with the mouse
        tooltip.style("left", (event.pageX + 10) + "px")
               .style("top", (event.pageY - 10) + "px");
     })
     .on("mouseout", function() {
        // Hide the tooltip when the mouse leaves the point
        tooltip.style("display", "none");
     });

  // Create and append x-axis
  var xAxis = d3.axisBottom(xScale)
              .ticks(10);

  svg.append("g")
    .attr("transform", `translate(0,${yScale(0)})`) // Position at y = 0
    .call(xAxis);

  // Create and append y-axis
  var yAxis = d3.axisLeft(yScale)
              .ticks(10);

  svg.append("g")
    .attr("transform", `translate(${xScale(0)},0)`) // Position at x = 0
    .call(yAxis);
  
  // Add dropdowns
  // Create dropdowns for BABEL and HumanML3D
  var babelDropdown = d3.select("#babelDropdown").append("select").attr("id", "babelSelect");
  var humanml3dDropdown = d3.select("#humanml3dDropdown").append("select").attr("id", "humanml3dSelect");

  babelDropdown.append("option").attr("value", "").text("Select a BABEL text");
  humanml3dDropdown.append("option").attr("value", "").text("Select a HumanML3D text");

  babelDropdown.selectAll("option.babelOption")
              .data(babelTextList)
              .enter()
              .append("option")
              .attr("class", "babelOption")
              .attr("value", function(d) { return d; })
              .text(function(d) { return d; });

  humanml3dDropdown.selectAll("option.humanOption")
                  .data(humanml3dTextList)
                  .enter()
                  .append("option")
                  .attr("class", "humanOption")
                  .attr("value", function(d) { return d; })
                  .text(function(d) { return d; });

  // Handle events for the BABEL text dropdown
  babelDropdown.on("change", function() {
    var selectedBabelText = this.value;

    // Clear corresponding HumanML3D texts and also the #babelTexts section
    d3.select("#humanml3dTexts").text("");  // Clear previous HumanML3D texts
    d3.select("#babelTexts").text("");  // Clear previous BABEL texts
    humanml3dDropdown.property('value', ''); // Reset HumanML3D dropdown

    if (selectedBabelText === "") {
      svg.selectAll("circle").attr("fill", "grey");
      return;
    }

    // Show corresponding HumanML3D texts line by line
    var correspondingHumanml3dTexts = points.filter(function(d) {
      return d.labels.includes(selectedBabelText);
    }).map(function(d) {
      return d.humanml3d_text;
    });

    correspondingHumanml3dTexts = Array.from(new Set(correspondingHumanml3dTexts)); // Remove duplicates

    // Display corresponding HumanML3D texts line by line
    d3.select("#humanml3dTexts").html("Corresponding HumanML3D Texts:<br>" +
      correspondingHumanml3dTexts.map(function(d) {
      return "<div>" + d + "</div>";  // Display each text in a new line
    }).join(""));

    // Update the plot
    svg.selectAll("circle")
      .attr("fill", function(d) {
        if (d.labels.includes(selectedBabelText)) {
          return babelTextToColor[selectedBabelText];
        } else {
          return "grey";
        }
      });
  });

  // Handle events for the HumanML3D text dropdown
  humanml3dDropdown.on("change", function() {
    var selectedHumanml3dText = this.value;

    // Clear corresponding BABEL texts and also the #humanml3dTexts section
    d3.select("#babelTexts").text("");  // Clear previous BABEL texts
    d3.select("#humanml3dTexts").text("");  // Clear previous HumanML3D texts
    babelDropdown.property('value', ''); // Reset BABEL dropdown

    if (selectedHumanml3dText === "") {
      svg.selectAll("circle").attr("fill", "grey");
      return;
    }

    // Show corresponding BABEL texts line by line
    var correspondingBabelTexts = points.filter(function(d) {
      return d.humanml3d_text === selectedHumanml3dText;
    }).map(function(d) {
      return d.labels;
    });

    correspondingBabelTexts = Array.from(new Set([].concat.apply([], correspondingBabelTexts))); // Flatten and remove duplicates

    // Display corresponding BABEL texts line by line
    d3.select("#babelTexts").html("Corresponding BABEL Texts:<br>" +
      correspondingBabelTexts.map(function(d) {
      return "<div>" + d + "</div>";  // Display each text in a new line
    }).join(""));

    // Update the plot
    svg.selectAll("circle")
      .attr("fill", function(d) {
        if (d.humanml3d_text === selectedHumanml3dText) {
          return "blue"; // Highlight color for selected HumanML3D text
        } else {
          return "grey";
        }
      });
  });

  // Show all points with their colors (when the button is clicked)
  d3.select("#showAllPoints").on("click", function() {
    svg.selectAll("circle")
        .attr("fill", function(d) {
          // Points with BABEL labels get their color, otherwise they remain grey
          if (d.labels.length > 0) {
            return babelTextToColor[d.labels[0]];  // Use the color of the first BABEL label
          } else {
            return "grey";  // No BABEL label, so stay grey
          }
        });
  });
}
