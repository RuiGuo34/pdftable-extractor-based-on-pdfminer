function getIndicesOf(str, keywords) {
	var searchlength = keywords.length;
	if (searchlength == 0) return [];
	var startIndex = 0, index, indices = [];
	while ((index = str.indexOf(keywords, startIndex)) > -1) {
		indices.push(index);
		startIndex = index + searchlength;
	}
	return indices;
}

function parseBorderLine (content) {
	var indexes = [], i = -1;
	//mark: sometimes the color of the table is not black (fixed)

	var tmp_len = 'position:absolute; border: '.length;
	while ((i = content.indexOf('position:absolute; border:', i+1)) != -1) {		
		if (content.substr(i+tmp_len, 7) != 'textbox') {
			indexes.push(i);
		}
	}

	var block = [];

	for (var i = 0; i < indexes.length; i++) {
		if (i != indexes.length - 1) {
			var span = indexes[i+1] - indexes[i];
			block.push(content.substr(indexes[i], span));
		}
		else {
			var temp = content.substr(indexes[i], content.length - indexes[i]);
			var end = temp.indexOf('>');
			block.push(temp.substr(0, end));
		}
	}
	return block;
}

function parseCurrPage(pagenum, filedir) {
	var fs = require('fs');
	var filecontent = fs.readFileSync(filedir).toString();
	var searched_page = pagenum.toString();
	var start = '<a name="'+searched_page+'">Page '+searched_page+'</a></div>';
	var index_start = filecontent.indexOf(start);
	var parsedcontent = filecontent.substring(index_start);
	var end = '<div style="position:absolute; top:';
	var index_end = parsedcontent.indexOf(end);
	var content = filecontent.substr(index_start, index_end);
	return content;
}

function getCellInfo(block) {
	var coordinate = [];
	for (var i = 0; i < block.length; i++) {
		var curr_line = block[i];
		var res = curr_line.split(";");
		var coordinate_split_left = res[2].split(":");
		var coordinate_split_top = res[3].split(":");
		var coordinate_split_width = res[4].split(":");
		var coordinate_split_height = res[5].split(":");
		
		var left = coordinate_split_left[1];
		var top = coordinate_split_top[1];
		var width = coordinate_split_width[1];
		var height = coordinate_split_height[1];

		left = parseInt(left);
		top = parseInt(top);
		width = parseInt(width);
		height = parseInt(height);

		var single_coordinate = [left, top, width, height];
		coordinate.push(single_coordinate);
	}
	//given the starting coordinate of the pixel, find all the possible point intersection
	//therefore at the moment, need to find the smallest starting row and column.
	var row_test = coordinate[0][1]; //i.e. in this example, 13255, there may be some cases that row_test varies in 1...
	//make sure that row_test is the smallest row. pdf rendering might not is sorted order
	for (var i = 0; i < coordinate.length; i++) {
		if (row_test > coordinate[i][1]) row_test = coordinate[i][1];
	}

	var col = [];

	for (var i = 0; i < coordinate.length; i++) {
		if ((coordinate[i][1] <= row_test+1 && coordinate[i][1] >= row_test) && coordinate[i][3] != 0) {
			if (col.indexOf(coordinate[i][0]) == -1) {
				col.push(coordinate[i][0]);
			}
		}
	}
	// console.log(col);
	var col_test = col[0]; // in here we need to check if the col_test is the smallest as well

	for (var i = 0; i < col.length; i++) {
		if (col_test > col[i]) col_test = col[i];
	}

	var row = [];
	for (var i = 0; i < coordinate.length; i++) {
		if ((coordinate[i][0] >= col_test && coordinate[i][0] <= col_test + 1) && coordinate[i][2] != 0) {
			if (row.indexOf(coordinate[i][1] == -1)) {
				row.push(coordinate[i][1]);
			}
		}
	}
	// console.log(row);
	var row_length = row.length;
	var col_length = col.length;

	cell_pos = []; //cell_pos position
	for (var i = 0; i < row_length-1; i++) {
		var temp_row = [];
		for (var j = 0; j < col_length-1; j++) {
			var upper_left = [col[j], row[i]];
			var lower_right = [col[j+1], row[i+1]];
			temp_row.push([upper_left,lower_right]);
		}

		cell_pos.push(temp_row);
	}

	return cell_pos;
}

function extractTextInfo(pageContent) {
	var text_indexes = [], i = -1;

	while ((i = pageContent.indexOf('position:absolute; border: textbox 1px solid;', i+1)) != -1) {
		text_indexes.push(i);
	}

	var text_block = [];

	for (var i = 0; i < text_indexes.length; i++) {
		if (i != text_indexes.length - 1) {
			var span = text_indexes[i+1] - text_indexes[i];
			text_block.push(pageContent.substr(text_indexes[i], span));
		}
		else {
			var temp = pageContent.substr(text_indexes[i], pageContent.length - text_indexes[i]);
			var end = temp.indexOf('<br>');
			text_block.push(temp.substr(0, end));
		}
	}

	text_info = [];

	for (var i = 0; i < text_block.length; i++) {
		//getting the coordinate information
		var res = text_block[i].split(";");
		
		var coordinate_split_left = res[3].split(":");
		var coordinate_split_top = res[4].split(":");
		var coordinate_split_width = res[5].split(":");
		var coordinate_split_height = res[6].split(":");

		var left = coordinate_split_left[1];
		var top = coordinate_split_top[1];
		var width = coordinate_split_width[1];
		var height = coordinate_split_height[1];

		left = parseInt(left);
		top = parseInt(top);
		width = parseInt(width);
		height = parseInt(height);

		var single_coordinate = [left, top, width, height];

		//getting the text field
		var sample = text_block[i];
		var mark = 'font-size';
		var res = ''; 
		var index_start = sample.indexOf(mark);

		var sub_sample = sample.substr(index_start);
		
		//this piece of code has some errors
		//possible solution: rewrite a function that searches for all the indexes in the text containing 
		//font-size: 14 px as well as the parsing of newline (\n) (fixed)
		// if (i == 6) {
		indices = getIndicesOf(sub_sample,'font-size');
		var result = "";
		for (var l = 0; l < indices.length; l++) {
			var index_start = indices[l];
			var curr_sample = sub_sample.substr(index_start+16);
			var index_start = curr_sample.indexOf('</span>');
			if (index_start != -1) {
				curr_sample = curr_sample.substring(0, index_start);
			}
			curr_sample = curr_sample.split("<br>").join("");
			curr_sample = curr_sample.split("\n").join("");

			result += curr_sample;
		}

		text_info.push([single_coordinate, result]);
	}
	return text_info;
}

function fillCell(cell_pos, text_info) {
	var table_data = [];
	for (var i = 0; i < cell_pos.length; i++) {
		var cell_data = [];
		for (var j = 0; j < cell_pos[0].length; j++) {
			var table_data_row = [];
			var cell_info = cell_pos[i][j];
			var curr_cell_upper_left_x = cell_info[0][0];
			var curr_cell_upper_left_y = cell_info[0][1];
			var curr_cell_lower_right_x = cell_info[1][0];
			var curr_cell_lower_right_y = cell_info[1][1];

			var append = "";

			for (var k = 0; k < text_info.length; k++) {
				var textbox = text_info[k];
				var text_x = textbox[0][0];
				var text_y = textbox[0][1];
				
				if (text_x >= curr_cell_upper_left_x && text_x <= curr_cell_lower_right_x && text_y >= curr_cell_upper_left_y && text_y < curr_cell_lower_right_y) {
					append += textbox[1];
				}
			}
			cell_data.push(append);
		}
		table_data.push(cell_data);
	}


	for (var i = 0; i < table_data.length;) {
		var flag = true;
		for (var j = 0; j < table_data[0].length; j++) {
			if (table_data[i][j] != '') flag = false;
		}
		if (flag) {
			table_data.splice(i,1);
		}
		else {
			i++;
		}
	}
	return table_data;
}

function writeToFile(table_data) {
	var fs = require('fs');
	var res = '';
	for (var i = 0; i < table_data.length; i++) {
		for (var j = 0; j < table_data[0].length; j++) {
			if (!j) {
				res += table_data[i][j];
			}
			else {
				res += '\t' + table_data[i][j];
			}
		}
		res += '\n';
	}
	console.log(res);
	fs.writeFile("/Users/Legolas/Documents/pdftests/Medicare.txt", res, function(err) {
    	if(err) {
        	return console.log(err);
    	}	

    	console.log("The file was saved!");
	});
}

function extractTableData(pagenum, filedir) {
	//get the current page 
	var pageContent = parseCurrPage(pagenum, filedir);

	//parse the border line
	var block = parseBorderLine(pageContent);

	//parse each border line info and retrieve the cell information(i.e. coordinate of upperleft,lowerright point)
	var cell_pos = getCellInfo(block);

	var text_info = extractTextInfo(pageContent);
	//locate the text content inside each cell
	var table_data = fillCell(cell_pos, text_info);

	writeToFile(table_data);
	return table_data;
}

filename = '/Users/Legolas/Documents/pdftests/Medicare.html';
page_number = 18;
table_res = extractTableData(page_number, filename);
// console.log(table_res);