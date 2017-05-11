// beginning of the main program
var fs = require('fs');

// specify the dir of converted html file and output csv file directory.

// example 1 for Open Payment
filename = '/Users/okitasouji/Documents/pdftests/Open.html';
outdir = '/Users/okitasouji/Documents/pdftests/Open.csv';

// filename = '/Users/okitasouji/Documents/pdftests/Medicare.html';
// outdir = '/Users/okitasouji/Documents/pdftests/Medicare.csv';

// convert html to array of string line by line. 
var filecontent = fs.readFileSync(filename).toString().split('\n');

// specify the anchor strings, now assume anchor string is unique in the html file

// multipage test for Open.html
// begin_word = 'Table B-1:';
// end_word = 'C-30';

// multipage test for Medicare.html
// begin_word = 'The 2012 data are re-published';
// end_word = 'Standard deviation of payments';

// single page test for Open.html
begin_word = 'Table 3-1:';
end_word = 'Table 3-2:';

var begin_line_index = [];
var end_line_index = [];

// record the line number where the search keyword appeared. 
for (i in filecontent) {
	if (filecontent[i].indexOf(begin_word) != -1) {
		begin_line_index.push(i);
	}
	if (filecontent[i].indexOf(end_word) != -1) {
		end_line_index.push(i);
	}
}

// In the future: generate possible start and end pair.
// Now assume search will definitely give one unique pair
// of start and end index value.

// check start and end index to see if they are in the same page. Set a flag
// to record this bool since it needs different operations depending on the 
// flag.

var samePageFlag = testPageRange(begin_line_index, end_line_index, filecontent);

// *** the following code segment is for anchor points that are in different pages ***
if (!samePageFlag) {
	// if not in the same page, need to locate the page range in order to include the
	// text and border within the search range. 

	// get start and end's line top pixel information:
	// read through the start and end's line string, record the start and 
	// end's top pixels postions. Use this pair of pixel to search and store 
	// all the text and border chunks in between.

	// record the starting and ending top pixels information.
	var start_index = getIndex(filecontent, begin_line_index);
	var end_index = getIndex(filecontent, end_line_index);

	// extract all the related textboxes and borders (might contain extra borders for parsing)
	var res= extractData(begin_line_index, end_line_index, filecontent);
	var textChunk = res[0];
	var borderChunk = res[1];

	// record the total number of page in between the anchors for later usage
	var total_page = textChunk.length;

	// parsing and extracting cell data informations....
	// getCellInfo read and parse the borderChunk, and it stores the each cell's upper left position
	// and lower right position for each page. 
	// In this case: we stil want to store the table based on page and in the end, and pend all the tables
	// together in the end. The reason is there are page heading and page footing in between which are redundant 
	// information we don't need. 
	 
	cell_info = [];
	for (var i = 0; i < total_page; i++) {
		cell_info[i] = getCellInfo(borderChunk[i]);
	}
	// check the first page and last page to see if they are in range. 
	// first bracket refers to page index (e.g. 0 means first page), second bracket: store num of cells in row. 
	parseRedundantCell(0, cell_info, textChunk, start_index, "small");
	parseRedundantCell(cell_info.length-1, cell_info, textChunk, end_index, "large");

	// after filtering the borders, we need to fill the text in the borders accordingly.
	// first step is parse each text line to get the text string and its coordinate information,
	// then store the text in the cell if the text coordinates fit in the cell (in between the 
	// upper left and lower right coordinate). For each page we ran, we form the table and append
	// it to the destination file.
	writeToFile(outdir, textChunk, cell_info);
}

// *** the following code segment is for anchor points that are in same page ***
if (samePageFlag) {
	var res = extractData(begin_line_index,end_line_index,filecontent);
	var start_index = getIndex(filecontent, begin_line_index);
	var end_index = getIndex(filecontent, end_line_index);
	var textChunk = res[0];
	var borderChunk = res[1];

	var total_page = textChunk.length;
	cell_info = [];
	for (var i = 0; i < total_page; i++) {
		cell_info[i] = getCellInfo(borderChunk[i]);
	}
	// console.log(start_index);
	// console.log(end_index);
	parseSinglePageCell(0, cell_info, textChunk, start_index, end_index);
	writeToFile(outdir, textChunk, cell_info);
}

function parseSinglePageCell(pagenum, cell_info, textChunk, lowerBound, upperBound) {
	while (cell_info[pagenum].length != 0 && cell_info[pagenum][0][0][0][1] < lowerBound) {
			cell_info[pagenum].shift();
	}

	while (cell_info[pagenum].length != 0 && cell_info[pagenum][cell_info[pagenum].length-1][0][1][1] > upperBound) {
		cell_info[pagenum].splice(cell_info[pagenum].length-1, 1);
	}

	if (cell_info[pagenum].length == 0) {
		cell_info.splice(pagenum,1);
		textChunk.splice(pagenum,1);
	}
}

// this function reads the text and cell info and generate the table accordingly. 
// after generating the table for each page, append the table in the output file.
function writeToFile(outdir, textChunk, cell_info) {
	var fs = require('fs');
	if (fs.existsSync(outdir)) {
		fs.unlinkSync(outdir); // empty the destination file to prepare for write
	}

	for (var k = 0; k < textChunk.length; k++) {
		// extract the text info and fill the text in the cell for each page
		currPageInfo = extractTextInfo(textChunk[k]);
		var table_data = fillCell(cell_info[k], currPageInfo);

		// convert in the csv style format
		var res = 'page '+ (k+1).toString() +'\n';
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

		// append each page
		fs.appendFile(outdir, res, function(err) {
	    	if(err) {
	        	return console.log(err);
	    	}
		});
	}
}

// given the cell positions and text information (coordinate and string), 
// generate the table data and fill the cell accordingly. 
function fillCell(cell_pos, text_info) {
	var table_data = [];

	// propagate and fill the table
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
		// sometimes the it will generate an entire empty row. need to remove the row in this case.
		for (var j = 0; j < table_data[i].length; j++) {
			if (table_data[i][j] != '')	flag = false;
		}
		if (flag) {
			table_data.splice(i,1);
		}
		else {
			//remove redundant tab from the beginning
			for (var j = 0; j < table_data[i].length;) {
				if (table_data[i][j] == '') {
					table_data[i].splice(j,1);
				}
				else {
					j++;
				}
			}
			i++;
		}
	}
	return table_data;
}

// a helper function in extractTextInfo which will return the index of keywords in the str. 
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

// extract the text information form the html, in the return, it will return a list containing
// each text chunk and its coordinate information.
function extractTextInfo(pageContent) {

	text_block = pageContent;
	text_info = [];

	for (var i = 0; i < text_block.length; i++) {
		//getting the text coordinate information
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

		// getting the text field string, remove the html tag and other redundant information.
		var sample = text_block[i];
		var mark = 'font-size';
		var res = ''; 
		var index_start = sample.indexOf(mark);

		var sub_sample = sample.substr(index_start);

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

// parse the redundant cells that should not appear in the range, comp parameter specifies whether is the start anchor or 
// the end anchor. 
function parseRedundantCell(pagenum, cell_info, textChunk, boundary_idx, comp) {
	if (comp == "small") {
		while (cell_info[pagenum].length != 0 && cell_info[pagenum][0][0][0][1] < boundary_idx) {
			cell_info[pagenum].shift();
		}
	}

	if (comp == "large") {
		while (cell_info[pagenum].length != 0 && cell_info[pagenum][cell_info[pagenum].length-1][0][1][1] > boundary_idx) {
			cell_info[pagenum].splice(cell_info[pagenum].length-1, 1);
		}
	}

	if (cell_info[pagenum].length == 0) {
		cell_info.splice(pagenum,1);
		textChunk.splice(pagenum,1);
	}
}

// a helper function to provide comparator for sorting (used in sorting the top coordinate)
function sortNumber(a,b) {
	return a - b;
}

// read the each border line, parse the pixel information, remove redundant cell
// and generate upper left coordinate and lower right coordinate for each unique cell. 
function getCellInfo(block) {
	var coordinate = [];
	// parse the pixel information
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

	// given the starting coordinate of the pixel, find all the possible point intersection

	filter_x = [];
	filter_y = [];
	for (var i = 0; i < coordinate.length; i++) {
		//recognize long vertical lines
		if (coordinate[i][2] <= 1 && coordinate[i][3] > 10) {
			filter_x.push(coordinate[i]);
		}
		if (coordinate[i][2] > 10 && coordinate[i][3] <= 1) {
			filter_y.push(coordinate[i]);
		}
	}
	col = [];
	for (var i = 0; i < filter_x.length; i++) {
		//column may contain duplicates, needs to remove dup
		var curr = filter_x[i][0]; 
		var dup_flag = true;
		for (var j = 0; j < col.length; j++) {
			if (col[j] == curr) dup_flag = false;
		}
		if (dup_flag) col.push(curr);
	}

	// pdf rendering might not in sorted order need to sort first
	col.sort(sortNumber);

	// remove row duplicates 
	row = [];
	for (var i = 0; i < filter_y.length; i++) {
		var curr = filter_y[i][1];
		var dup_flag = true;
		for (var j = 0; j < row.length; j++) {
			if (row[j] == curr) dup_flag = false;
		}
		if (dup_flag) row.push(curr);
	}

	row.sort(sortNumber);

	cell_pos = []; //cell_pos position
	for (var i = 0; i < row.length-1; i++) {
		var temp_row = [];
		for (var j = 0; j < col.length-1; j++) {
			var upper_left = [col[j], row[i]];
			var lower_right = [col[j+1], row[i+1]];
			temp_row.push([upper_left,lower_right]);
		}

		cell_pos.push(temp_row);
	}

	return cell_pos;
}

// the top index for the anchor, later use for border parsing
function getIndex(filestring, idx) {
	var currString = filestring[idx];
	var coordinate = currString.split(";");
	var coordinate_split_top = coordinate[4].split(":");
	var top = coordinate_split_top[1];
	top = parseInt(top);
	return top;	
}

// test if anchors reside in the same page
function testPageRange(start_index, end_index, filecontent) {
	for (var i = parseInt(start_index[0]); i < parseInt(end_index[0]); i++) {
		if (filecontent[i].indexOf('textbox') == -1) {
			return false;
		}
	}
	return true;
}

// helper function to extract all the text and border 
function extractData(begin_line_index, end_line_index, filecontent) {
	text = [];
	border = [];
	text_temp = [];
	border_temp = [];
	var i = parseInt(begin_line_index[0]);

	// Read each line in range, determine whether it stores text or border info and store
	// it respectively. 
	while (i <= parseInt(end_line_index[0])) {

		if (filecontent[i].indexOf('a name') != -1) {
			text.push(text_temp);
			border.push(border_temp);
			text_temp = [];
			border_temp = [];
		}
		if (filecontent[i].indexOf('textbox') != -1) {
			text_temp.push(filecontent[i]);
		}
		if (filecontent[i].indexOf('border: black') != -1) {
			border_temp.push(filecontent[i]);
		}
		i++;
	}

	// check if there are textboxes included in the last page 
	// since above algorithm only run lines between two search 
	// keywords. for the last page where end keyword resides, it
	// didn't run over the border information. Need to do a further
	// search over the ending line but stop before new page appears.

	if (text_temp.length != 0) {
		while (filecontent[i].indexOf('a name') == -1) {
			if (filecontent[i].indexOf('border: black') != -1) {
				border_temp.push(filecontent[i]);
			}
			i++;
		}
		text.push(text_temp);
		border.push(border_temp);
	}
	return [text, border];
}
