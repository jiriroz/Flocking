/*Flocking simulation created using paper.js with the help
of Daniel Shiffman's book The Nature of Code.
Jiri Roznovjak, 2015.*/

var WIDTH = 800;
var HEIGHT = 600;
document.getElementById('canvas').style.width = WIDTH;
document.getElementById('canvas').style.height = HEIGHT;

//size of one square for the bin-lattice spacial subdivision
var RESOLUTION = 20;
//all velocities are multiplied by this constant, use for scaling
var VELOCITYSCALE = 0.9;

//Vehicle that has methods for displaying itself, steering,
//and pursuing/escaping a target.
var Vehicle = function (x,y,size) {
    this.velocity = new Point(0,0);
    this.acceleration = new Point(0,0);
    this.maxspeed = 5*VELOCITYSCALE;
    this.maxsteer = 0.5*VELOCITYSCALE;
    this.mass = 1;
    this.lastAngle = 0;
    this.size = size;
    this.count = 0;
    this.display(x,y);
};

Vehicle.prototype.display = function (x,y) {
    this.body = new Path.Circle([x,y],this.size);
    this.body.fillColor = new Color(0,0,0);
};

Vehicle.prototype.run = function () {
    this.updateDirection();
    this.update();
    this.checkEdges();
};

Vehicle.prototype.updateDirection = function () {
};

Vehicle.prototype.update = function () {
    this.velocity += this.acceleration;
    this.body.position += this.velocity;
    this.acceleration *= 0;
};

//when the vehicle get beyond the screen edge, it
//will appead on the other side
Vehicle.prototype.checkEdges = function () {
    if (this.body.position.x < 0) {
        this.body.position.x = WIDTH;
    } else if (this.body.position.x > WIDTH) {
        this.body.position.x = 0;
    }
    if (this.body.position.y < 0) {
        this.body.position.y = HEIGHT;
    } else if (this.body.position.y > HEIGHT) {
        this.body.position.y = 0;
    }
};

//calculates segments of the tail
Vehicle.prototype.calculateTail = function (tail,origin) {
    var segments = tail.segments;
    var speed = this.velocity.length;
    var pieceLength = 1 + speed / 2;
    var point = origin;
    // Chain goes the other way than the movement
    var lastVector = -this.velocity;
    for (var i = 0; i < segments.length; i++) {
        var vector = segments[i].point - point;
        this.count += speed * 100;
        var wave = Math.sin((this.count + i * 3) / 200);
        var sway = lastVector.rotate(90).normalize(wave);
        point += lastVector.normalize(pieceLength) + sway;
        segments[i].point = point;
        lastVector = vector;
    }
    tail.smooth();
};

Vehicle.prototype.applyForce = function (force) {
    force /= this.mass;
    this.acceleration += force;
};
//this method makes change of direction look smoother
Vehicle.prototype.steer = function (desired) {
    desired = desired.normalize(this.maxspeed);
    var steerForce = desired - this.velocity;
    //not able to change the length of the steer force directly
    if (steerForce.length > this.maxsteer) {
        steerForce = steerForce.normalize(this.maxSteer);
    }
    return steerForce;
};

//steer towards a targer
Vehicle.prototype.goTo = function (targetPos) {
    var desired = targetPos - this.body.position;
    return this.steer(desired);
};

//steer away from a target
Vehicle.prototype.goAwayFrom = function (targetPos) {
    var desired = this.body.position - targetPos;
    return this.steer(desired);
};

Vehicle.prototype.isWithinDistance = function (obj,margin) {
    var dist = (this.body.position - obj.body.position).length;
    return dist < margin;
};

//In order to make the flocking more efficient, the canvas is divided
//into so called bin-lattice spacial subdivision, which are many small
//squares with the length of the side specified by the variable RESOLUTION.
//This method takes the subdivision and returns all vehicles that are
//contained within the vehicle's bin and in neighboring bins.
Vehicle.prototype.getNeighbors = function (subdivision) {
    var x,y;
    var len = subdivision.length;
    var sublen = subdivision[0].length;
    var col = parseInt(this.body.position.x / RESOLUTION);
    var row = parseInt(this.body.position.y / RESOLUTION);
    col = limit(col,0,WIDTH/RESOLUTION - 1);
    row = limit(row,0,HEIGHT/RESOLUTION - 1);
    var neighborhood = [[1,0],[-1,0],[0,1],[0,-1],[0,0],
    [1,1],[-1,1],[1,-1],[-1,-1],[0,2],[0,-2],[-2,0],[2,0]];
    var neighbors = [];
    for (var i=0; i<neighborhood.length; i++) {
    var x = col + neighborhood[i][0];
    var y = row + neighborhood[i][1];
    if (isWithinArray(x,len) && isWithinArray(y,sublen)) {
        neighbors = neighbors.concat(subdivision[x][y]);
        }
    }
    return neighbors;
};

//Prey that inherits from Vehicle and in addition has the ability
//to flock.
var Prey = function (x,y) {
    Vehicle.call(this,x,y,3);
    this.maxspeed = 7*VELOCITYSCALE;
    this.maxsteer = 0.2*VELOCITYSCALE;
};

Prey.prototype = Object.create(Vehicle.prototype);

Prey.prototype.run = function () {
    Vehicle.prototype.run.call(this);
    this.calculateTail(this.tail,this.body.position);
};

Prey.prototype.display = function (x,y) {
    var color = new Color(Math.random()*0.3,
        Math.random()*0.3,
        Math.random()*0.3);
    this.body = new Path.Circle({
        center: [x, y],
        radius: this.size,
        fillColor: color
    });
    this.tail = new Path({
        strokeColor: color,
        strokeWidth: 2,
        strokeCap: 'round'
    });
    for (var i = 0; i < 5; i++) {
        this.tail.add(new Point());
    }
};

//applies flocking rules and escaping from the predators
Prey.prototype.applyBehaviors = function (flock,predators) {
    this.applyRules(flock);
    var sumEscape = new Point(0,0);
    for (var i=0; i<predators.length; i++) {
        if (this.isWithinDistance(predators[i],120)) {
            var escape = this.goAwayFrom(predators[i].body.position);
            escape *= 3;
            sumEscape += escape;
        }
    }
    if (sumEscape.length > 0) {
        this.acceleration *= 0;
        this.applyForce(sumEscape);
    }
};

//applies the rules for flocking: separation, alignment, cohesion
Prey.prototype.applyRules = function (flock) {
    var flockArray = this.getNeighbors(flock.subdivision);
    var countSeparation = 0;
    var countAlignment = 0;
    var neighborhood = 100;
    var desiredSeparation = 40;
    var velocities = new Point(0,0);
    var separate = new Point(0,0);
    for (var i=0; i<flockArray.length; i++) {
        var dist = this.body.position.getDistance(flockArray[i].body.position);
            if (dist > 0) {
                if (dist < neighborhood) {
                    velocities += flockArray[i].velocity;
                    countAlignment++;
                }
                if (dist < desiredSeparation) {
                var diff = this.body.position-flockArray[i].body.position;
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
        alignment *= 2;
        this.applyForce(alignment);
    }
    if (countSeparation > 0) {
        separate /= countSeparation;
        var separation = this.steer(separate);
        separation *= 1.2;
        this.applyForce(separation);
    }
};

//predator object that inherits from Vehicle and has the ability to
//chase prey.
var Predator = function (x,y) {
    Vehicle.call(this,x,y,7);
    this.maxspeed = 12*VELOCITYSCALE;
    this.maxsteer = 0.4*VELOCITYSCALE;
};

Predator.prototype = Object.create(Vehicle.prototype);

Predator.prototype.run = function () {
    Vehicle.prototype.run.call(this);
    this.calculateTail(this.mainTail,this.body.position);
    var offset = this.velocity.rotate(90).normalize(6);
    this.calculateTail(this.leftTail,this.body.position - offset);
    this.calculateTail(this.rightTail,this.body.position + offset);
};

Predator.prototype.display = function (x,y) {
    this.body = new Path.Circle([x,y],this.size);
    this.body.fillColor = new Color(1,0,0);
    
    this.mainTail = new Path({
        strokeColor: "red",
        strokeWidth: 3,
        strokeCap: "round"
    });
    this.leftTail = new Path({
        strokeColor: "red",
        strokeWidth: 2,
        strokeCap: "round"
    });
    this.rightTail = new Path({
        strokeColor: "red",
        strokeWidth: 2,
        strokeCap: "round"
    });
    for (var i = 0; i < 7; i++) {
        this.mainTail.add(new Point());
        if (i > 2) {
            this.leftTail.add(new Point());
            this.rightTail.add(new Point());
        }
    }
};

Predator.prototype.applyBehaviors = function (flock) {
    var hunt = this.findNearest(flock);
    this.applyForce(hunt);
};

Predator.prototype.findNearest = function (flock) {
    var flockArray = flock.flock;
    var nearest = [10000,-1];
    for (var i=0; i<flockArray.length; i++) {
        var dist = this.body.position.getDistance(flockArray[i].body.position);
        if (dist < nearest[0]) {
            nearest[0] = dist;
            nearest[1] = i;
        }
    }
    if (nearest[1] === -1) {
        return new Point(0,0);
    }
    return this.goTo(flockArray[nearest[1]].body.position);
};

Predator.prototype.isEating = function (prey) {
    var margin = this.size + prey.size;
    return this.isWithinDistance(prey,margin);
};

//collection of prey objects that allows to apply flocking behaviors
//to them.
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

//Assigns each prey to a spacial subdivision
Flock.prototype.assignToSubsets = function () {
    this.createEmptySubdivision();
    for (var i=0; i<this.flock.length; i++) {
        var col = parseInt(this.flock[i].body.position.x/RESOLUTION);
        var row = parseInt(this.flock[i].body.position.y/RESOLUTION);
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
                this.flock[i].body.remove();
                this.flock[i].tail.remove();
                this.flock.splice(i,1);
                createRandomBoid(Prey,this.flock);
                break;
            }
        }
    }
};

Flock.prototype.computeAvgPosition = function () {
    var avgPos = new Point(0,0);
    for (var i=0; i<this.flock.length; i++) {
        avgPos += this.flock[i].body.position;
    }
    if (this.flock.length > 0) {
        this.center = avgPos/this.flock.length;
    }
};

//group of predators. Doesn't add any new functionality,
//only makes the coding easier.
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

//bounds of the cavnas
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

var Background = function () {
    this.image = new Raster("img/sea_texture.jpg");
    this.image.position = [WIDTH/2,HEIGHT/2];
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

var background = new Background();
var bounds = new Bounds();
var flock = new Flock(50);
var predators = new Predators(1);

var execute = function () {
    flock.run(predators);
    predators.run(flock);
};

onFrame = function (event) {
    execute();
};
