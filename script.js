/*Flocking simulation created using paper.js with the help
of Daniel Shiffman's book The Nature of Code.
Jiri Roznovjak, 2015.*/

var WIDTH = 1200;
var HEIGHT = 600;
document.getElementById('canvas').style.width = WIDTH;
document.getElementById('canvas').style.height = HEIGHT;

var MOUSEPOINT = new Point(WIDTH/2,HEIGHT/2);
var RESOLUTION = 100;
var VELOCITYSCALE = 1.3;

var Vehicle = function (x,y,size) {
	this.velocity = new Point(0,0);
	this.acceleration = new Point(0,0);
	this.maxspeed = 5*VELOCITYSCALE;
	this.maxsteer = 0.5*VELOCITYSCALE;
	this.mass = 1;
	this.lastAngle = 0;
	this.size = size;
	this.display(x,y);
};

Vehicle.prototype.display = function (x,y) {
	this.image = new Path.Circle([x,y],this.size);
	this.image.fillColor = new Color(0,0,0);
};

Vehicle.prototype.run = function () {
	this.update();
	this.checkEdges();
};

Vehicle.prototype.update = function () {
	this.velocity += this.acceleration;
	this.image.position += this.velocity;
	this.acceleration *= 0;
};

Vehicle.prototype.checkEdges = function () {
	if (this.image.position.x < 0) {
		this.image.position.x = WIDTH;
	} else if (this.image.position.x > WIDTH) {
		this.image.position.x = 0;
	}
	if (this.image.position.y < 0) {
		this.image.position.y = HEIGHT;
	} else if (this.image.position.y > HEIGHT) {
		this.image.position.y = 0;
	}
};

Vehicle.prototype.applyBehaviors = function () {
};

Vehicle.prototype.applyForce = function (force) {
	force /= this.mass;
	this.acceleration += force;
};

Vehicle.prototype.steer = function (desired) {
	desired = desired.normalize(this.maxspeed);
	var steerForce = desired - this.velocity;
	//not able to change the length of the steer force directly
	if (steerForce.length > this.maxsteer) {
		steerForce = steerForce.normalize(this.maxSteer);
	}
	return steerForce;
};

Vehicle.prototype.goTo = function (targetPos) {
	var desired = targetPos - this.image.position;
	return this.steer(desired);
};

Vehicle.prototype.goAwayFrom = function (targetPos) {
	var desired = this.image.position - targetPos;
	return this.steer(desired);
};

Vehicle.prototype.isWithinDistance = function (obj,margin) {
	var dist = (this.image.position - obj.image.position).length;
	return dist < margin;
};

Vehicle.prototype.getNeighbors = function (subdivision) {
	var x,y;
	var len = subdivision.length;
	var sublen = subdivision[0].length;
	var col = parseInt(this.image.position.x / RESOLUTION);
	var row = parseInt(this.image.position.y / RESOLUTION);
	col = limit(col,0,WIDTH/RESOLUTION - 1);
	row = limit(row,0,HEIGHT/RESOLUTION - 1);
	var neighborhood = [[1,0],[-1,0],[0,1],[0,-1]];
	var neighbors = subdivision[col][row];
	for (var i=0; i<neighborhood.length; i++) {
		var x = col + neighborhood[i][0];
		var y = row + neighborhood[i][1];
		if (isWithinArray(x,len) && isWithinArray(y,sublen)) {
			neighbors = neighbors.concat(subdivision[x][y]);
		}
	}
	return neighbors;
};

var Prey = function (x,y) {
	Vehicle.call(this,x,y,3);
	this.maxspeed = 6*VELOCITYSCALE;
	this.maxsteer = 0.2*VELOCITYSCALE;
};

Prey.prototype = Object.create(Vehicle.prototype);

Prey.prototype.display = function (x,y) {
	this.image = new Path.Circle([x,y],this.size);
	var r = Math.random()*0.5;
	var g = Math.random()*0.5;
	var b = Math.random()*0.5;
	this.image.fillColor = new Color(r,g,b);
};

Prey.prototype.applyBehaviors = function (flock,predators) {
	this.applyRules(flock);
	var sumEscape = new Point(0,0);
	for (var i=0; i<predators.length; i++) {
		if (this.isWithinDistance(predators[i],100)) {
			var escape = this.goAwayFrom(predators[i].image.position);
			escape = escape.normalize(5);
			sumEscape += escape;
		}
	}
	if (sumEscape.length > 0) {
		this.acceleration *= 0;
		this.applyForce(sumEscape);
	}
};

Prey.prototype.applyRules = function (flock) {
	var flockArray = this.getNeighbors(flock.subdivision);
	var countSeparation = 0;
	var countAlignment = 0;
	var neighborhood = 100;
	var desiredSeparation = 50;
	var velocities = new Point(0,0);
	var separate = new Point(0,0);
	for (var i=0; i<flockArray.length; i++) {
		var dist = this.image.position.getDistance(flockArray[i].image.position);
		if (dist > 0) {
			if (dist < neighborhood) {
				velocities += flockArray[i].velocity;
				countAlignment++;
			}
			if (dist < desiredSeparation) {
				var diff = this.image.position-flockArray[i].image.position;
				diff = diff.normalize();
				diff /= dist;
				separate += diff;
				countSeparation++;
			}
		}
	}
	if (flockArray.length > 0) {
		var cohesion = this.goTo(flock.center);
		cohesion *= 0.75;
		this.applyForce(cohesion);
	}
	if (countAlignment > 0) {
		velocities /= countAlignment;
		var alignment = this.steer(velocities);
		alignment *= 1.5;
		this.applyForce(alignment);
	}
	if (countSeparation > 0) {
		separate /= countSeparation;
		var separation = this.steer(separate);
		separation *= 1;
		this.applyForce(separation);
	}
};

var Predator = function (x,y) {
	Vehicle.call(this,x,y,7);
	this.maxspeed = 8*VELOCITYSCALE;
	this.maxsteer = 0.4*VELOCITYSCALE;
};

Predator.prototype = Object.create(Vehicle.prototype);

Predator.prototype.display = function (x,y) {
	this.image = new Path.Circle([x,y],this.size);
	this.image.fillColor = new Color(1,0,0);
};

Predator.prototype.applyBehaviors = function (flock) {
	var hunt = this.findNearest(flock);
	this.applyForce(hunt);
};

Predator.prototype.findNearest = function (flock) {
	var flockArray = flock.flock;
	var nearest = [10000,-1];
	for (var i=0; i<flockArray.length; i++) {
		var dist = this.image.position.getDistance(flockArray[i].image.position);
		if (dist < nearest[0]) {
			nearest[0] = dist;
			nearest[1] = i;
		}
	}
	if (nearest[1] === -1) {
		return new Point(0,0);
	}
	return this.goTo(flockArray[nearest[1]].image.position);
};

Predator.prototype.isEating = function (prey) {
	var margin = this.size + prey.size;
	if (this.isWithinDistance(prey,margin)) {
		return true;
	} else {return false;}
};

var Flock = function (count) {
	this.flock = [];
	this.center = new Point(0,0);
	this.createFlock(count);
	this.assignToSubsets();
};

Flock.prototype.createFlock = function (count) {
	for (var i=0; i<count; i++) {
		createRandomBoid(Prey,this.flock);
	}
};

Flock.prototype.assignToSubsets = function () {
	this.createEmptySubdivision();
	for (var i=0; i<this.flock.length; i++) {
		var col = parseInt(this.flock[i].image.position.x/RESOLUTION);
		var row = parseInt(this.flock[i].image.position.y/RESOLUTION);
		col = limit(col,0,WIDTH/RESOLUTION - 1);
		row = limit(row,0,HEIGHT/RESOLUTION - 1);
		this.subdivision[col][row].push(this.flock[i]);
	}
};

Flock.prototype.createEmptySubdivision = function () {
	this.subdivision = [];
	for (var col=0; col<WIDTH/RESOLUTION; col++) {
		this.subdivision.push([]);
		for (var row=0; row<HEIGHT/RESOLUTION; row++) {
			this.subdivision[col].push([]);
		}
	}
};

Flock.prototype.run = function (predators) {
	this.computeAvgPosition();
	this.assignToSubsets();
	var predatorArray = predators.predators;
	for (var i=0; i<this.flock.length; i++) {
		this.flock[i].applyBehaviors(this,predatorArray);
		this.flock[i].run();
		for (var j=0; j<predatorArray.length; j++) {
			if (predatorArray[j].isEating(this.flock[i])) {
				this.flock[i].image.remove();
				this.flock.splice(i,1);
				break;
			}
		}
	}
};

Flock.prototype.computeAvgPosition = function () {
	var avgPos = new Point(0,0);
	for (var i=0; i<this.flock.length; i++) {
		avgPos += this.flock[i].image.position;
	}
	if (this.flock.length > 0) {
		this.center = avgPos/this.flock.length;
	}
};

var Predators = function (count) {
	this.predators = [];
	this.createPredators(count);
};

Predators.prototype.createPredators = function (count) {
	for (var i=0; i<count; i++) {
		createRandomBoid(Predator,this.predators);
	}
};

Predators.prototype.run = function (flock) {
	for (var i=0; i<this.predators.length; i++) {
		this.predators[i].applyBehaviors(flock);
		this.predators[i].run();
	}
};

var Bounds = function () {
	this.path = new Path();
	this.path.strokeColor = 'black';
	this.path.add(new Point(0,0), new Point(0,HEIGHT),
				  new Point(WIDTH,HEIGHT), new Point(WIDTH,0));
	this.path.closed = 'true';
};

Bounds.prototype.remove = function () {
	this.path.remove();
};

var createRandomBoid = function (Type,array) {
	var x = Math.random()*WIDTH;
	var y = Math.random()*HEIGHT;
	array.push(new Type(x,y));
};

var isWithinArray = function (index,arrayLength) {
	return index >= 0 && index < arrayLength;
};

var limit = function (n,lower,upper) {
	if (n < lower) {
		return lower;
	} else if (n > upper) {
		return upper;
	} else {
		return n;
	}
};

var bounds = new Bounds();
var flock = new Flock(30);
var predators = new Predators(1);

onFrame = function (event) {
	flock.run(predators);
	predators.run(flock);
};

onMouseDown = function (event) {
	MOUSEPOINT = event.point;


};