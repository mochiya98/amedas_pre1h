/* global THREE */
const BAR_SIZE = 3;
const BAR_GEOMETRY = new THREE.BoxGeometry(BAR_SIZE, 1, BAR_SIZE);
const MATERIAL_CYAN = new THREE.MeshLambertMaterial({color: "#0ff"});

function rainRenderer(container){
	this.renderer = new THREE.WebGLRenderer();
	container.appendChild(this.renderer.domElement);
	
	this._initScene();
	this._initCamera();
	this._adjustWindowSize();
	window.addEventListener("resize", this._adjustWindowSize.bind(this));
	
	this.bars = new Map();
}
rainRenderer.prototype._initScene = function(){
	const light = new THREE.DirectionalLight("#fff", 1.5);
	light.position
		.set(0, 400, 500)
		.normalize();
	this.scene = new THREE.Scene();
	this.scene.add(light);
	this.scene.add(this.g = new THREE.Group());
};
rainRenderer.prototype._initCamera = function(){
	this.camera = new THREE.PerspectiveCamera(45, 1, 1, 2000);
	this.camera.position.set(300, 400, 500);//0,750,0
	this.camera.lookAt(this.scene.position);
};
rainRenderer.prototype._adjustWindowSize = function(){
	this.camera.aspect = window.innerWidth / window.innerHeight;
	this.camera.updateProjectionMatrix();
	this.renderer.setSize(window.innerWidth, window.innerHeight);
	this.controls = new THREE.TrackballControls(this.camera);
};

rainRenderer.prototype.addBar = function(id, x, y, height){
	const mesh = new THREE.Mesh(BAR_GEOMETRY, MATERIAL_CYAN);
	mesh.position.set(x, 900, y);
	this.bars.set(id, {mesh});
	this.g.add(mesh);
};

rainRenderer.prototype.render = function(){
	this.renderer.render(this.scene, this.camera);
};


function mapMap(opt){
	this.opt = opt;
	this.opt.latitude_range = this.opt.latitude_start - this.opt.latitude_end;
	this.opt.longitude_range = this.opt.longitude_end - this.opt.longitude_start;
	new THREE.TextureLoader()
		.load(
			opt.url,
			(texture) => {
				this.w = texture.image.width / 2;
				this.h = texture.image.height / 2;
				texture.minFilter = THREE.LinearFilter;

				const geometry = new THREE.PlaneGeometry(1, 1, 5, 5);
				const material = new THREE.MeshBasicMaterial({map : texture,
					side: THREE.DoubleSide});
				const plane = new THREE.Mesh(geometry, material);
				plane.scale.set(this.w, this.h, 1);
				plane.rotation.x = -Math.PI / 2;
				opt.rr.g.add(plane);
				opt.rr.render();
			}
		);
}
mapMap.prototype.calcXY = function(ll){
	const x = (ll.longitude - this.opt.longitude_start) / this.opt.longitude_range * this.h - this.h / 2;
	const y = (1 - (ll.latitude - this.opt.latitude_end) / this.opt.latitude_range) * this.w - this.w / 2;
	return{
		x,
		y,
	};
};

(async()=>{
	const rr = new rainRenderer(document.getElementById("rr_container"));
	const mm = new mapMap({
		url            : "./assets/japan.png",
		latitude_start : 44.4,
		latitude_end   : 28.6,
		longitude_start: 125,
		longitude_end  : 150.1,
		rr,
	});
	const amedas_db = new Map();
	{
		let lastTime = Date.now();
		function animate(){
			requestAnimationFrame(animate);
			
			const now = Date.now();
			const timeDiff = now - lastTime;
			lastTime = now;
			
			rr.g.rotation.y -= 0.1 * timeDiff * Math.PI / 1000;
			rr.controls.update();
			rr.render();
		}
		animate();
	}
	//load amedas-metadata
	await fetch("./assets/ame_master.csv")
		.then(async res=>{
			const text = await res.text();
			const data = text
				.split("\r\n")
				.slice(1)
				.filter(c=>c !== "")
				.map(c=>c.split(","))
				.map(c=>{
					const id = c[1];
					//const name=c[3];
					//const name2=c[5];
					const latitude = c[6] * 1 + c[7] / 60;
					const longitude = c[8] * 1 + c[9] / 60;
					const{x, y} = mm.calcXY({
						latitude,
						longitude,
					});
					return{
						id,
						/*
						name,
						name2,
						*/
						latitude,
						longitude,
						x,
						y,
					};
				});
			for(const amedas of data){
				amedas_db.set(amedas.id, amedas);
			}
		});
	//load amedas-data(base)
	await fetch("./assets/pre1h00_rct.csv")
		.then(async res=>{
			const text = await res.text();
			const data = text
				.split("\r\n")
				.slice(1)
				.filter(c=>c !== "")
				.map(c=>c.split(","))
				.map(c=>{
					const id = c[0];
					const now = c[9] * 3;
					return{
						id,
						now,
					};
				});
			for(const amedas_data of data){
				const amedas = amedas_db.get(amedas_data.id);
				rr.addBar(
					amedas_data.id,
					amedas.x,
					amedas.y,
					amedas_data.now + 0.3
				);
			}
		});
	//load amedas-data(1day)
	const dt = document.getElementById("dt");
	await fetch("./assets/data_0706.json")
		.then(async res=>{
			const data =
			Object.entries(await res.json())
				.map(c=>[
					rr.bars.get(c[0]), //bar
					c[1].map(d=>d + .3), //amedas_data(array)
				]);
			const max_idx = data[0][1].length;
			let idx = 0;
			setInterval(()=>{
			//update bar-height
				for(const[bar, amedas_data]of data){
					if(bar.mesh.scale.y !== amedas_data[idx]){
						bar.mesh.position.setY(amedas_data[idx] / 2);
						bar.mesh.scale.setY(amedas_data[idx]);
					}
				}
				//update timestamp
				const date = new Date("2018/07/06 00:00:00");
				date.setMinutes(idx * 10);
				dt.textContent = date.toString();
			
				if(++idx >= max_idx)idx = 0;
			}, 32);
		});
})();
