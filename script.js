// TODO
// back and forward buttons
// color code solution text

var React = require("react");
var ReactDOM = require("react-dom");
var Heap = require("collections/heap");

// display color and send it back up on click
function Square(props) {
	return (
		<button className="square" style={{backgroundColor: numberToColor[props.color]}} onClick={() => props.onClick()}></button>
	);
}

// renders board based on info from Game
function Board(props) {
	return (
		<div className="board" style={{height: props.colors.length * 52}}>
			{props.colors.map((column, x) =>
				<span className="board-column" key={"column"+x}>{column.map((color, y) => 
				   <div className="square" key={x+""+y}>
				   	<Square color={color} onClick={() => props.onClick(x,y)}/>
			   	</div>)}
				</span>
			)}
		</div>
	);
}

// game logic and state
//
// props:
// size: width of game board
// numColors: number of possible colors 
class Game extends React.Component {

	constructor(props) {
		super(props);

		// initialize variables
		this.state = {
			status: "",
			solutionMoves: "?",
			solution: "",
			moveNumber: 0,
			colors: new Array(),
		}

		// hidden variable to store human readable solution
		this.solution = "";

		// initialize game state
		this.initializeBoard(true);
	}

	// reset board and UI on size / numColor change
	componentWillReceiveProps(nextProps) {
		this.props = nextProps;
		this.setState({solution: "", status: ""});
		this.initializeBoard();
	}

	initializeBoard(firstTime = false) {
		// store starting board state for resets
		this.startingConnectivity = Array(this.props.size);
		this.startingColors = Array(this.props.size);
		this.connectivity = Array(this.props.size);

		// initialize colors and connectivity arrays
		let colorInt;
	   for (let x = 0; x < this.props.size; x++) {
	    	this.state.colors[x] = Array(this.props.size);
	    	this.startingColors[x] = Array(this.props.size);
	    	this.connectivity[x] = Array(this.props.size);
			for (let y = 0; y < this.props.size; y++) {

				// randomize starting state
				colorInt = Math.floor(Math.random() * this.props.numColors);
				this.state.colors[x][y] = colorInt;
				this.startingColors[x][y] = colorInt;
				this.connectivity[x][y] = false;
			}
		}

		// variables to store current board state
		this.moveHistory = new Array();
		this.tempColors = this.duplicate2dArray(this.startingColors);
		this.startingConnectivity = this.duplicate2dArray(this.connectivity);

		// initialize the connectivity matrix
		this.updateConnectivity();

		// update UI
		// on initial load, these are handled in componentWillMount
		if (!firstTime) {
			this.setState({moveNumber: 0, solution: ""});
			this.displayTempColors();
			this.solve();
		}
	}

	// update UI and find solution
	componentWillMount() {
		this.displayTempColors();
		this.solve();
	}

	// copies hidden color matrix to UI
	// tempColors is used by all methods because it can be updated instantaneously
	displayTempColors() {
		this.setState({colors: this.tempColors});
	}

	// determine which squares are part of the flood
	// uses tempColors instead of state.colors
	updateConnectivity() {
		let connectivity = this.duplicate2dArray(this.connectivity);
		const size = this.props.size;
		const colors = this.duplicate2dArray(this.tempColors);
		const activeColor = colors[0][0];

		// keep track of which squares have already been checked
		let checked = Array(size);
		for (let x = 0; x < size; x++) {
			checked[x] = Array(size)
			for (let y = 0; y < size; y++) {
				checked[x][y] = false;
			}
		}

		// starting from the top left, see which squares are connected and the same color
		let square;
		let queue = [{x: 0, y: 0}];
		while (queue.length > 0) {
			// get the next connected square from the queue
			square = queue.pop();

			// see if it's the same color as top left
			if (colors[square.x][square.y] === activeColor) {
				connectivity[square.x][square.y] = true;

				// add adjacent squares to queue
				// if they haven't already been checked
				if (square.x > 0 && !checked[square.x - 1][square.y]) { queue.push({x: (square.x - 1), y: square.y}); }
				if (square.x < size - 1 && !checked[square.x + 1][square.y]) { queue.push({x: (square.x + 1), y: square.y}); }
				if (square.y > 0 && !checked[square.x][square.y - 1]) { queue.push({x: square.x, y: (square.y - 1)}); }
				if (square.y < size - 1 && !checked[square.x][square.y + 1]) { queue.push({x: square.x, y: (square.y + 1)}); }
			}

			// mark square as checked
			checked[square.x][square.y] = true;
		}

		this.connectivity = this.duplicate2dArray(connectivity);
	}

	// change color of all squares which are connected to the top left
	// does *not* update UI
	changeFloodColor(newColor) {
		let colors = this.duplicate2dArray(this.tempColors);
		const connectivity = this.duplicate2dArray(this.connectivity);
		const size = this.props.size;

		for (let x = 0; x < size; x++) {
			for (let y = 0; y < size; y++) {
				if (connectivity[x][y]) {
					colors[x][y] = newColor;
				}
			}
		}

		this.tempColors = this.duplicate2dArray(colors);
	}

	// find shortest solution
	// for simpler games uses BFS to always find the shortest solution
	// for more complex games uses A* to solve in a reasonable amount of time
	solve() {
		// variables for BFS
		let currentPath = new Array();

		// variables for A* search
		let h, boardHash, nextChild;
		let closedList = {};
		let children = new Array();
		let numConnected, numAdjacent, numColorsRemaining;
		let numConnectedWeight = 0.15;
		let numAdjacentWeight = 0.15;
		let numColorsRemainingWeight = -5;
		let colorPresent = new Array(this.props.numColors);

		let adjacency = new Array();
		for (let i = 0; i < this.props.size; i++) {
			adjacency.push(new Array(this.props.size));
		}

		let heap = new Heap([], null, (a,b) => (b.path.length + b.h) - (a.path.length + a.h));

		// start from the beginning
		this.resetBoard();

		while (true) { // loop is exited via break if this.gameIsOver() == true
			if (this.props.size < 5 && this.props.numColors < 5) {
				// breadth first search
				// guaranteed to find the shortest path but very slow
				currentPath = this.findNextMove(currentPath, currentPath.length);

			} else {
				// A* search
				// might not find the shortest path but much faster
				
				// evaluate h factors:
				// number of squares in flood
				// number of squares adjacent to flood
				// number of colors still active

				// reset variables
				numConnected = 0;
				colorPresent = new Array(this.props.numColors);
				for (let i = 0; i < this.props.numColors; i++) {
					colorPresent[i] = false;
				}
				adjacency = new Array(this.props.size);
				for (let i = 0; i < this.props.size; i++) {
					adjacency[i] = new Array(this.props.size);
				}

				// evaluate h
				for (let x = 0; x < this.props.size; x++) {
					for (let y = 0; y < this.props.size; y++) {
						if (this.connectivity[x][y] === true) {
							// counter for how many squares are in the flood
							numConnected++;

							// matrix to keep track of how many squares are adjacent to the flood 
							adjacency[x][y] = true;
							if (x > 0) { adjacency[x - 1][y] = true; }
							if (x < this.props.size - 1) { adjacency[x + 1][y] = true; }
							if (y > 0) { adjacency[x][y - 1] = true; }
							if (y < this.props.size - 1) { adjacency[x][y + 1] = true; }
						} else {
							// not counting the flood,
							// keep track of how many colors are left on the board
							colorPresent[this.tempColors[x][y]] = true;
						}
					}
				}
				numColorsRemaining = colorPresent.reduce((acc, cur) => acc + (cur ? 1 : 0), 0);
				numAdjacent = adjacency.map((column) => column.reduce((acc, cur) => acc + (cur ? 1 : 0), 0)).reduce((acc, cur) => acc + cur);
				numAdjacent = numAdjacent - numConnected;
				h = this.props.size - (numAdjacentWeight * numAdjacent + numColorsRemainingWeight * numColorsRemaining + numConnectedWeight * numConnected);

				// check if there's a shorter path to the same state in closedList
				boardHash = this.getBoardHash().toString();
				if (closedList[boardHash] === undefined || closedList[boardHash].length > currentPath.length) {
					
					// replace / create entry in closedList
					closedList[boardHash] = currentPath;

					// add the current state to the heap to evaluate children later
					heap.push({path: currentPath, h: h});
				}

				// find next path to evaluate
				// takes a sibling node if possible
				// otherwise looks for the next best option
				nextChild = children.pop();
				if (nextChild === undefined) {
					children = this.findChildren(heap.pop()["path"]);
					currentPath = children.pop();
				} else {
					currentPath = nextChild;
				}
			}

			// advance board state to match currentPath
			this.setBoardStateTo(currentPath);

			// check for solution
			if (this.gameIsOver()) {
				break;
			}
		}

		// convert currentPath from numbers to colors (0 -> "red", etc)
		this.solution = currentPath.reduce((prev, curr) => prev.concat(numberToColor[curr] + ", "), "").slice(0,-2);
		
		// reset board to beginning of game
		this.resetBoard();

		// push changes to UI
		this.displayTempColors();
		this.setState({solutionMoves: currentPath.length, status: "", moveNumber: 0});
	}

	// determine the next unique move for BFS
	// traverses the tree of all possible move sequences
	// 
	// currentPath (array<int>) the path leading to the current move
	// numMoves (int) how many moves have been taken AKA tree depth
	//
	// arguments should be (currentPath, currentPath.length)
	// all examples assume numColors = 3
	findNextMove(currentPath, numMoves) {
		const numColors = this.props.numColors;
		let currentMove, nextMove;

		if (currentPath.length == 0) {

			// build starting path of numMoves length
			// this will always take the form 01010[...]
			numMoves++;
			currentPath.push(0);
			while (currentPath.length < numMoves) {
				currentMove = currentPath.pop();
				nextMove = currentMove == 0 ? 1 : 0;
				currentPath.push(currentMove, nextMove);
			}
		
		} else {
			// increment last move, if possible
			// and rebuild path to length of numMoves if necessary

			currentMove = currentPath.pop();
			if (currentMove < numColors - 1) {
				if (currentMove + 1 != currentPath[currentPath.length - 1]) {
					// simple incremenation is possible
					// ie 020 => 021
					currentPath.push(currentMove + 1);

				} else if (currentMove + 2 < numColors) {
					// next incremenation is a duplicate, but extra incrementation is valid 
					// ie 010 => 012
					currentPath.push(currentMove + 2);

				} else {
					// next incremenation is a duplicate, and extra incrementation is invalid
					// requires modification of parent
					// ie 021 => 101
					return this.findNextMove(currentPath, numMoves);

				}
			} else {
				// move up a level and try again
				return this.findNextMove(currentPath, numMoves);
			}

			// currentPath is now valid and incremented
			// but may be too short
			while (currentPath.length < numMoves) {
				// like the currentPath.length == 0 case, fills out remainder with 0101[...]
				currentMove = currentPath.pop();
				nextMove = currentMove == 0 ? 1 : 0;
				currentPath.push(currentMove, nextMove);
			}

		}
		
		return currentPath;
	}

	// returns list of potential next moves for A* search
	findChildren(path) {
		const lastMove = path[path.length - 1];
		let children = new Array(this.props.numColors - 1);
		for (let i = 0; i < this.props.numColors; i++) {
			if (i != lastMove) {
				children.push(path.concat(i));
			}
		}
		return children;
	}

	// replicates the moves given as parameter
	setBoardStateTo(path) {
		this.resetBoard();
		path.map(function(moveInt) {
			this.changeFloodColor(moveInt);
			this.updateConnectivity();
		}, this);
	}

	// converts board state to a unique integer
	// by multiplying each square's colorInt by the nth prime
	getBoardHash() {
		const primeList = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223, 227, 229, 233, 239, 241, 251, 257, 263, 269, 271, 277, 281, 283, 293, 307, 311, 313, 317, 331, 337, 347, 349, 353, 359, 367, 373, 379, 383, 389, 397, 401, 409, 419, 421, 431, 433, 439, 443, 449, 457, 461, 463, 467, 479, 487, 491, 499, 503, 509, 521, 523, 541, 547, 557, 563, 569, 571, 577, 587, 593, 599, 601, 607, 613, 617, 619, 631, 641, 643, 647, 653, 659, 661, 673, 677, 683, 691, 701, 709, 719, 727, 733, 739, 743, 751, 757, 761, 769, 773, 787, 797, 809, 811, 821, 823, 827, 829, 839, 853, 857, 859, 863, 877, 881, 883, 887, 907, 911, 919, 929, 937, 941, 947, 953, 967, 971, 977, 983, 991, 997, 1009, 1013, 1019, 1021, 1031, 1033, 1039]
		let result = 0;
		let i = 10;
		this.tempColors.map((column) => 
			column.map((squareColor) =>
				result += squareColor * this.props.numColors * primeList[i++]
		));
		return result;
	}

	// show / hide solution in UI
	toggleSolution() {
		if (this.state.solution == "") {
			this.setState({solution: this.solution});
		} else {
			this.setState({solution: ""});
		}

	}

	// checks if connectivity matrix is all true
	gameIsOver() {
		const connectivity = this.duplicate2dArray(this.connectivity);

		for (let x = 0; x < connectivity.length; x++) {
			for (let y = 0; y < connectivity[x].length; y++) {
				if (!connectivity[x][y]) {
					return false;
				}
			}
		}

		return true;
	}

	// change board back to how it was at the start of the game
	resetBoard() {
		this.tempColors = this.startingColors;
		this.connectivity = this.startingConnectivity;
		this.updateConnectivity();
	}

	// creates a deep copy of a 2d array
	duplicate2dArray(targetArray) {
		let dupArray = new Array();
		targetArray.map((e) => dupArray.push(e.slice()));
		return dupArray;
	}

	// change flood color to match the square that was clicked
	handleClick(x,y) {
		const colors = this.duplicate2dArray(this.state.colors);
		if (colors[x][y] != colors[0][0]) {
			let newState = {};

			// update game board
			this.changeFloodColor(colors[x][y]);
			this.updateConnectivity();

			// increment moveNumber
			newState["moveNumber"] = this.state.moveNumber + 1;

			// update moveHistory
			this.moveHistory[this.state.moveNumber] = colors[x][y];
			this.moveHistory = this.moveHistory.slice(0, this.state.moveNumber + 1);

			if (this.gameIsOver()) {
				if (this.state.moveNumber + 1 == this.state.solutionMoves) {
					newState["status"] = "You win!";
				} else {
					newState["status"] = "Try again";
				}
			}

			// push changes to UI
			this.setState(newState);
			this.displayTempColors();
		}
	}

	resetBtnClicked() {
		// reset game state
		this.resetBoard();

		// push changes to UI
		this.displayTempColors();
		this.moveHistory = new Array();
		this.setState({status: "", moveNumber: 0});
	}

	undoBtnClicked() {
		// roll back the last move, if possible
		if (this.state.moveNumber > 0) {
			this.setBoardStateTo(this.moveHistory.slice(0, this.state.moveNumber - 1));
			this.displayTempColors();
			this.setState({moveNumber: this.state.moveNumber - 1});
		}
	}

	redoBtnClicked() {
		// move forward a move, if the undo button has been clicked at least once
		if (this.state.moveNumber < this.moveHistory.length) {
			this.setBoardStateTo(this.moveHistory.slice(0, this.state.moveNumber + 1));
			this.displayTempColors();
			this.setState({moveNumber: this.state.moveNumber + 1});
		}
	}

	render() {
		let solutionBtnStyle = {
			backgroundColor: this.state.solution == "" ? "white" : "gray" 
		};
		let undoBtnStyle = {
			backgroundColor: this.state.moveNumber > 0 ? "white" : "gray"
		};
		let redoBtnStyle = {
			backgroundColor: this.state.moveNumber < this.moveHistory.length ? "white" : "gray"
		}
		return (
			<div>
				<Board colors={this.state.colors} onClick={(x,y) => this.handleClick(x,y)}/>
				<div className="controlContainer">
					<div className="moveControlContainer">
						<ControlBtn active={this.state.moveNumber > 0} onClick={() => this.undoBtnClicked()} text="Undo"/>
						<ControlBtn active={this.state.moveNumber < this.moveHistory.length} onClick={() => this.redoBtnClicked()} text="Redo"/>
					</div>
					<ControlBtn active={true} onClick={() => this.initializeBoard()} text="New"/>
					<ControlBtn active={true} onClick={() => this.resetBtnClicked()} text="Restart"/>
					<ControlBtn active={this.state.solution == ""} onClick={() => this.toggleSolution()} text="Solution"/>
					<div className="outputText" id="moveNumber">Move: {this.state.moveNumber}</div>
					<div className="outputText" id="solutionMoves">Goal: {this.state.solutionMoves}</div>
					<div className="outputText" id="solution">{this.state.solution}</div>
					<div id="status">{this.state.status}</div>
				</div>
			</div>
		);
	}
}

function ControlBtn(props) {
	let style = {
		backgroundColor: props.active ? "white" : "gray"
	};
	return (
		<button className="controlBtn" style={style} onClick={() => props.onClick()}>{props.text}</button>
	);
}

class Container extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			gameSize: 5,
			numColors: 5,
		}
	}

	handleGameSizeChange(e) {
		this.setState({gameSize: e.target.value});
	}

	handleNumColorsChange(e) {
		this.setState({numColors: e.target.value});
	}

	render() {
		return (
			<div>
	   		<select name="gameSize" defaultValue={this.state.gameSize} onChange={(e) => this.handleGameSizeChange(e)}>
	   			<option value="4">4x4</option>
	   			<option value="5">5x5</option>
	   			<option value="6">6x6</option>
	   			<option value="7">7x7</option>
	   			<option value="8">8x8</option>
	   			<option value="10">10x10</option>
	   			<option value="12">12x12</option>
	   		</select>
	   		<select name="numColors" defaultValue={this.state.numColors} onChange={(e) => this.handleNumColorsChange(e)}>
	   			<option value="3">3</option>
	   			<option value="4">4</option>
	   			<option value="5">5</option>
	   			<option value="6">6</option>
	   			<option value="7">7</option>
	   		</select>
	   		<Game size={this.state.gameSize} numColors={this.state.numColors}/>
   		</div>
   	);
	};
}

var numberToColor = {
	0: "red",
	1: "green",
	2: "blue",
	3: "purple",
	4: "gray",
	5: "orange",
	6: "black",
}

ReactDOM.render(
	<Container/>,
	document.getElementById('container')
);