var React = require("react");
var ReactDOM = require("react-dom");

// display color and send it back up on click
function Square(props) {
	return (
		<button className="square" style={{backgroundColor: numberToColor[props.color]}} onClick={() => props.onClick()}></button>
	);
}

// renders board based on info from Game
class Board extends React.Component {
	renderSquare(x, y, color) {
		return <Square color={color} onClick={() => this.props.onClick(x,y)}/>;
	}

	render() {
		const colors = this.props.colors.slice();
		const style = {
			height: this.props.colors.length * 52,
		}

		return (
   		<div className="board" style={style}>
   			{colors.map((column, x) =>
   				<span className="board-column" key={"column"+x}>{column.map((color, y) => 
   				   <div className="square" key={x+""+y}>{this.renderSquare(x, y, color)}</div>)}
   				</span>
   			)}
   		</div>
   	);
	};
}

// game logic and state
class Game extends React.Component {

	constructor(props) {
		super(props);

		this.state = {
			status: "",
			solutionMoves: "?",
			solution: "",
			moveNumber: 0,
			colors: new Array(),
		}

		this.solution = "";

		this.initializeBoard(true);
	}

	componentWillReceiveProps(nextProps) {
		this.props = nextProps;
		this.setState({solution: "", status: ""});
		this.initializeBoard();
	}

	initializeBoard(firstTime = false) {
		this.connectivity = Array(this.props.size);
		this.startingConnectivity = Array(this.props.size);
		this.startingColors = Array(this.props.size);
		this.tempColors = Array(this.props.size);

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
		this.tempColors = this.duplicate2dArray(this.startingColors);
		this.startingConnectivity = this.duplicate2dArray(this.connectivity);

		this.updateConnectivity();

		if (!firstTime) {
			this.setState({moveNumber: 0, solution: ""});
			this.displayTempColors();
			this.solve();
		}
	}

	componentWillMount() {
		this.displayTempColors();
		this.solve();
	}

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

		let square;
		let queue = [{x: 0, y: 0}];
		while (queue.length > 0) {
			square = queue.shift();

			if (checked[square.x][square.y]) {
				continue;
			}

			if (colors[square.x][square.y] === activeColor) {
				connectivity[square.x][square.y] = true;

				// add adjacent squares to queue
				if (square.x > 0 && !checked[square.x - 1][square.y]) { queue.push({x: (square.x - 1), y: square.y}); }
				if (square.x < size - 1 && !checked[square.x + 1][square.y]) { queue.push({x: (square.x + 1), y: square.y}); }
				if (square.y > 0 && !checked[square.x][square.y - 1]) { queue.push({x: square.x, y: (square.y - 1)}); }
				if (square.y < size - 1 && !checked[square.x][square.y + 1]) { queue.push({x: square.x, y: (square.y + 1)}); }
			}

			checked[square.x][square.y] = true;
		}

		this.connectivity = this.duplicate2dArray(connectivity);
	}

	// change color of all squares which are connected to the top left
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

	// determine the next unique move
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

	// find shortest solution
	// uses BFS and is very slow -- O((numColors-1)^gameSize)
	solve(BFS = true) {
		let newState = {};
		let currentPath = [0];
		this.resetBoard();

		if (BFS) {
			// breadth first search
			// guaranteed to find shortest path but very slow
			while (true) { // loop is exited via break if this.gameIsOver() == true
				this.resetBoard();
				currentPath.map(function(moveInt) {
					this.changeFloodColor(moveInt);
					this.updateConnectivity();
				}, this);

				if (this.gameIsOver()) {
					break;
				} else {
					currentPath = this.findNextMove(currentPath, currentPath.length);
				}
			}
		}

		this.solution = currentPath.reduce((prev, curr) => prev.concat(numberToColor[curr] + ", "), "").slice(0,-2);
		
		this.resetBoard();
		this.displayTempColors();
		this.setState({solutionMoves: currentPath.length, status: "", moveNumber: 0});
	}

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
		const flatten = arr => arr.reduce((a, b) => a.concat(Array.isArray(b) ? flatten(b) : b), []);

		if (flatten(connectivity).reduce((prev, curr) => prev && curr)) {
			return true;
		}

		return false;
	}

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
			this.changeFloodColor(colors[x][y]);
			this.updateConnectivity();

			let newState = {};
			newState["moveNumber"] = this.state.moveNumber + 1;

			if (this.gameIsOver()) {
				if (this.state.moveNumber + 1 == this.state.solutionMoves) {
					newState["status"] = "You win!";
				} else {
					newState["status"] = "Try again";
				}
			}

			this.setState(newState);
			this.displayTempColors();
		}
	}

	resetBtnClicked() {
		this.resetBoard();
		this.displayTempColors();
		this.setState({status: "", moveNumber: 0});
	}

	render() {
		let solutionBtnStyle = {
			backgroundColor: this.state.solution == "" ? "white" : "gray", 
		};
		return (
			<div>
				<Board colors={this.state.colors} onClick={(x,y) => this.handleClick(x,y)}/>
				<div className="controlContainer">
					<button className="controlBtn" onClick={() => this.initializeBoard()}>New</button>
					<button className="controlBtn" onClick={() => this.resetBtnClicked()}>Restart</button>
					<button className="controlBtn" style={solutionBtnStyle} onClick={() => this.toggleSolution()}>Solution</button>
					<div className="outputText" id="moveNumber">Move: {this.state.moveNumber}</div>
					<div className="outputText" id="solutionMoves">Goal: {this.state.solutionMoves}</div>
					<div className="outputText" id="solution">{this.state.solution}</div>
					<div id="status">{this.state.status}</div>
				</div>
			</div>
		);
	}
}

class Container extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			gameSize: 5,
			numColors: 4,
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
	   		<select name="gameSize" defaultValue="5" onChange={(e) => this.handleGameSizeChange(e)}>
	   			<option value="4">4x4</option>
	   			<option value="5">5x5</option>
	   			<option value="6">6x6</option>
	   			<option value="7">7x7</option>
	   			<option value="8">8x8</option>
	   			<option value="10">10x10</option>
	   			<option value="12">12x12</option>
	   		</select>
	   		<select name="numColors" defaultValue="4" onChange={(e) => this.handleNumColorsChange(e)}>
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