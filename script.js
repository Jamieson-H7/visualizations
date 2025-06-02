const canvas = document.getElementById('myCanvas');
const gl = canvas.getContext('webgl');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  gl.viewport(0, 0, canvas.width, canvas.height);
}

window.addEventListener('resize', () => {
  resizeCanvas();
  drawScene();
});
resizeCanvas();

// Vertex shader source
const vsSource = `
attribute vec3 aPosition;
attribute vec3 aColor;
uniform mat4 uMVP;
varying vec3 vColor;
void main() {
  gl_Position = uMVP * vec4(aPosition, 1.0);
  vColor = aColor;
}
`;

// Fragment shader source
const fsSource = `
precision mediump float;
varying vec3 vColor;
void main() {
  gl_FragColor = vec4(vColor, 1.0);
}
`;

// Compile shader
function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

// Create program
function createProgram(vsSource, fsSource) {
  const vs = compileShader(gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  return program;
}

const program = createProgram(vsSource, fsSource);

// Axes and unit vector geometry
// Each line: [x, y, z, r, g, b], two vertices per line
const sqrt3inv = 1 / Math.sqrt(3);
const vertices = new Float32Array([
  // X axis (red)
  0, 0, 0, 1, 0, 0,
  1, 0, 0, 1, 0, 0,
  // Y axis (green)
  0, 0, 0, 0, 1, 0,
  0, 1, 0, 0, 1, 0,
  // Z axis (blue)
  0, 0, 0, 0, 0, 1,
  0, 0, 1, 0, 0, 1,
  // Unit vector (orange)
  0, 0, 0, 1, 0.5, 0,
  sqrt3inv, sqrt3inv, sqrt3inv, 1, 0.5, 0,
]);

const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

const aPosition = gl.getAttribLocation(program, 'aPosition');
const aColor = gl.getAttribLocation(program, 'aColor');
const uMVP = gl.getUniformLocation(program, 'uMVP');

// --- Add grid geometry ---
let gridExtent = 1000;

const gridExtentSlider = document.getElementById('gridExtentSlider');
const gridExtentValue = document.getElementById('gridExtentValue');
if (gridExtentSlider && gridExtentValue) {
  gridExtentSlider.addEventListener('input', () => {
    gridExtent = Number(gridExtentSlider.value);
    gridExtentValue.textContent = gridExtent;
    drawScene();
  });
  gridExtentValue.textContent = gridExtentSlider.value;
  gridExtent = Number(gridExtentSlider.value);
}

// Simple perspective and view matrix
function getMVPMatrix() {
  // Perspective matrix
  function perspective(out, fovy, aspect, near, far) {
    const f = 1.0 / Math.tan(fovy / 2);
    out[0] = f / aspect;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;

    out[4] = 0;
    out[5] = f;
    out[6] = 0;
    out[7] = 0;

    out[8] = 0;
    out[9] = 0;
    out[10] = (far + near) / (near - far);
    out[11] = -1;

    out[12] = 0;
    out[13] = 0;
    out[14] = (2 * far * near) / (near - far);
    out[15] = 0;
    return out;
  }

  // LookAt matrix
  function lookAt(out, eye, center, up) {
    let x0, x1, x2, y0, y1, y2, z0, z1, z2, len;
    let eyex = eye[0],
      eyey = eye[1],
      eyez = eye[2];
    let upx = up[0],
      upy = up[1],
      upz = up[2];
    let centerx = center[0],
      centery = center[1],
      centerz = center[2];

    if (
      Math.abs(eyex - centerx) < 0.000001 &&
      Math.abs(eyey - centery) < 0.000001 &&
      Math.abs(eyez - centerz) < 0.000001
    ) {
      return identity(out);
    }

    z0 = eyex - centerx;
    z1 = eyey - centery;
    z2 = eyez - centerz;

    len = 1 / Math.hypot(z0, z1, z2);
    z0 *= len;
    z1 *= len;
    z2 *= len;

    x0 = upy * z2 - upz * z1;
    x1 = upz * z0 - upx * z2;
    x2 = upx * z1 - upy * z0;
    len = Math.hypot(x0, x1, x2);
    if (!len) {
      x0 = 0;
      x1 = 0;
      x2 = 0;
    } else {
      len = 1 / len;
      x0 *= len;
      x1 *= len;
      x2 *= len;
    }

    y0 = z1 * x2 - z2 * x1;
    y1 = z2 * x0 - z0 * x2;
    y2 = z0 * x1 - z1 * x0;

    len = Math.hypot(y0, y1, y2);
    if (!len) {
      y0 = 0;
      y1 = 0;
      y2 = 0;
    } else {
      len = 1 / len;
      y0 *= len;
      y1 *= len;
      y2 *= len;
    }

    out[0] = x0;
    out[1] = y0;
    out[2] = z0;
    out[3] = 0;
    out[4] = x1;
    out[5] = y1;
    out[6] = z1;
    out[7] = 0;
    out[8] = x2;
    out[9] = y2;
    out[10] = z2;
    out[11] = 0;
    out[12] = -(x0 * eyex + x1 * eyey + x2 * eyez);
    out[13] = -(y0 * eyex + y1 * eyey + y2 * eyez);
    out[14] = -(z0 * eyex + z1 * eyey + z2 * eyez);
    out[15] = 1;

    return out;
  }

  function multiply(out, a, b) {
    const o = out, m = a, n = b;
    for (let i = 0; i < 4; ++i) {
      const ai0 = m[i], ai1 = m[i + 4], ai2 = m[i + 8], ai3 = m[i + 12];
      o[i] = ai0 * n[0] + ai1 * n[1] + ai2 * n[2] + ai3 * n[3];
      o[i + 4] = ai0 * n[4] + ai1 * n[5] + ai2 * n[6] + ai3 * n[7];
      o[i + 8] = ai0 * n[8] + ai1 * n[9] + ai2 * n[10] + ai3 * n[11];
      o[i + 12] = ai0 * n[12] + ai1 * n[13] + ai2 * n[14] + ai3 * n[15];
    }
    return out;
  }

  // Add rotation matrix for user interaction
  function rotateY(out, a, rad) {
    const s = Math.sin(rad), c = Math.cos(rad);
    out[0] = c * a[0] + s * a[8];
    out[1] = c * a[1] + s * a[9];
    out[2] = c * a[2] + s * a[10];
    out[3] = c * a[3] + s * a[11];
    out[8] = c * a[8] - s * a[0];
    out[9] = c * a[9] - s * a[1];
    out[10] = c * a[10] - s * a[2];
    out[11] = c * a[11] - s * a[3];
    out[4] = a[4]; out[5] = a[5]; out[6] = a[6]; out[7] = a[7];
    out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15];
    return out;
  }
  function rotateX(out, a, rad) {
    const s = Math.sin(rad), c = Math.cos(rad);
    out[4] = c * a[4] - s * a[8];
    out[5] = c * a[5] - s * a[9];
    out[6] = c * a[6] - s * a[10];
    out[7] = c * a[7] - s * a[11];
    out[8] = c * a[8] + s * a[4];
    out[9] = c * a[9] + s * a[5];
    out[10] = c * a[10] + s * a[6];
    out[11] = c * a[11] + s * a[7];
    out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; out[3] = a[3];
    out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15];
    return out;
  }

  const persp = new Float32Array(16);
  const view = new Float32Array(16);
  const mvp = new Float32Array(16);

  // Camera setup: fixed camera, scale world by zoom before view/projection
  const r = 3;
  const elev = rotationX;
  const azim = rotationY;
  const camY = 2 * Math.cos(elev) + r * Math.sin(elev);
  const camXZ = r * Math.cos(elev);
  const camX = camXZ * Math.sin(azim);
  const camZ = -camXZ * Math.cos(azim);

  // Fixed FOV
  const fov = Math.PI / 3;
  perspective(persp, fov, canvas.width / canvas.height, 0.1, 100);
  lookAt(view, [camX, camY, camZ], [0, 0, 0], [0, 1, 0]);

  // Scale matrix for zoom (scale world, not camera)
  const scale = new Float32Array([
    zoom, 0,    0,    0,
    0,    zoom, 0,    0,
    0,    0,    zoom, 0,
    0,    0,    0,    1
  ]);

  // mvp = persp * view * scale
  const pv = new Float32Array(16);
  multiply(pv, persp, view);
  multiply(mvp, pv, scale);

  return mvp;
}

let vector = [0.6, 0.6, 0.6]; // keep for component/legacy, but not user-editable

// --- Matrix input as interactive table ---
const matrixTable = document.getElementById('matrixTable');
const addMatrixRow = document.getElementById('addMatrixRow');
let matrixVectors = [
  [1, 0, 0],
  [0, 1, 0]
];

function renderMatrixTable() {
  if (!matrixTable) return;
  const tbody = matrixTable.querySelector('tbody');
  tbody.innerHTML = '';
  for (let i = 0; i < matrixVectors.length; ++i) {
    const row = document.createElement('tr');
    for (let j = 0; j < 3; ++j) {
      const cell = document.createElement('td');
      cell.style.padding = '2px';
      const input = document.createElement('input');
      input.type = 'number';
      input.step = 'any';
      input.value = matrixVectors[i][j] ?? '';
      input.style.width = '48px';
      input.addEventListener('input', () => {
        const val = parseFloat(input.value);
        matrixVectors[i][j] = isFinite(val) ? val : 0;
        drawScene();
      });
      cell.appendChild(input);
      row.appendChild(cell);
    }
    // Remove row button
    const delCell = document.createElement('td');
    if (matrixVectors.length > 1) {
      const delBtn = document.createElement('button');
      delBtn.textContent = '–';
      delBtn.type = 'button';
      delBtn.style.width = '22px';
      delBtn.style.marginLeft = '4px';
      delBtn.onclick = () => {
        matrixVectors.splice(i, 1);
        renderMatrixTable();
        drawScene();
      };
      delCell.appendChild(delBtn);
    }
    row.appendChild(delCell);
    tbody.appendChild(row);
  }
}
if (matrixTable) renderMatrixTable();
if (addMatrixRow) {
  addMatrixRow.onclick = () => {
    matrixVectors.push([0, 0, 0]);
    renderMatrixTable();
    drawScene();
  };
}

function drawCylinderAndCone(from, to, colorBase, colorTip) {
  // Draw a wireframe cylinder from 'from' to 'to' (shaft), and a wider, shorter wireframe cone at 'to' (arrowhead)

  const [x0, y0, z0] = from;
  const [x1, y1, z1] = to;
  const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-6) return;

  // Cylinder (shaft)
  const shaftRadius = Math.min(0.018 * len, 0.018); // smaller width
  const headLen = Math.min(0.08 * len, 0.08); // shorter cone
  const shaftLen = Math.max(len - headLen, 0.01);
  const segments = 24;
  // Find orthogonal vectors for the circle
  let up = [0, 1, 0];
  if (Math.abs(dy / len) > 0.99) up = [1, 0, 0];
  // Side vector
  let side = [
    dy * up[2] - dz * up[1],
    dz * up[0] - dx * up[2],
    dx * up[1] - dy * up[0]
  ];
  let sideLen = Math.hypot(...side);
  if (sideLen < 1e-6) side = [1, 0, 0];
  else side = side.map(x => x / sideLen);
  // Second orthogonal vector
  let up2 = [
    dy * side[2] - dz * side[1],
    dz * side[0] - dx * side[2],
    dx * side[1] - dy * side[0]
  ];
  let up2Len = Math.hypot(...up2);
  if (up2Len < 1e-6) up2 = [0, 1, 0];
  else up2 = up2.map(x => x / up2Len);

  // Shaft base and top centers
  const base = [x0, y0, z0];
  const top = [
    x0 + dx * (shaftLen / len),
    y0 + dy * (shaftLen / len),
    z0 + dz * (shaftLen / len)
  ];

  // Draw shaft as lines around the cylinder (wireframe)
  let shaftVerts = [];
  for (let i = 0; i < segments; ++i) {
    const theta1 = (i / segments) * 2 * Math.PI;
    const theta2 = ((i + 1) / segments) * 2 * Math.PI;
    // Circle points at base
    const bx1 = base[0] + shaftRadius * (Math.cos(theta1) * side[0] + Math.sin(theta1) * up2[0]);
    const by1 = base[1] + shaftRadius * (Math.cos(theta1) * side[1] + Math.sin(theta1) * up2[1]);
    const bz1 = base[2] + shaftRadius * (Math.cos(theta1) * side[2] + Math.sin(theta1) * up2[2]);
    const bx2 = base[0] + shaftRadius * (Math.cos(theta2) * side[0] + Math.sin(theta2) * up2[0]);
    const by2 = base[1] + shaftRadius * (Math.cos(theta2) * side[1] + Math.sin(theta2) * up2[1]);
    const bz2 = base[2] + shaftRadius * (Math.cos(theta2) * side[2] + Math.sin(theta2) * up2[2]);
    // Circle points at top
    const tx1 = top[0] + shaftRadius * (Math.cos(theta1) * side[0] + Math.sin(theta1) * up2[0]);
    const ty1 = top[1] + shaftRadius * (Math.cos(theta1) * side[1] + Math.sin(theta1) * up2[1]);
    const tz1 = top[2] + shaftRadius * (Math.cos(theta1) * side[2] + Math.sin(theta1) * up2[2]);
    const tx2 = top[0] + shaftRadius * (Math.cos(theta2) * side[0] + Math.sin(theta2) * up2[0]);
    const ty2 = top[1] + shaftRadius * (Math.cos(theta2) * side[1] + Math.sin(theta2) * up2[1]);
    const tz2 = top[2] + shaftRadius * (Math.cos(theta2) * side[2] + Math.sin(theta2) * up2[2]);
    // Draw lines around base circle
    shaftVerts.push(
      bx1, by1, bz1, ...colorBase, bx2, by2, bz2, ...colorBase
    );
    // Draw lines around top circle
    shaftVerts.push(
      tx1, ty1, tz1, ...colorBase, tx2, ty2, tz2, ...colorBase
    );
    // Draw lines along the side
    shaftVerts.push(
      bx1, by1, bz1, ...colorBase, tx1, ty1, tz1, ...colorBase
    );
  }
  const shaftBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, shaftBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(shaftVerts), gl.STREAM_DRAW);
  gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 24, 0);
  gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 24, 12);
  gl.drawArrays(gl.LINES, 0, shaftVerts.length / 6);

  // Cone (arrowhead) - wider than shaft, shorter height
  const coneRadius = shaftRadius * 2.2;
  const coneBase = top;
  const coneTip = [x1, y1, z1];
  let coneVerts = [];
  for (let i = 0; i < segments; ++i) {
    const theta1 = (i / segments) * 2 * Math.PI;
    const theta2 = ((i + 1) / segments) * 2 * Math.PI;
    // Points on base circle
    const bx1 = coneBase[0] + coneRadius * (Math.cos(theta1) * side[0] + Math.sin(theta1) * up2[0]);
    const by1 = coneBase[1] + coneRadius * (Math.cos(theta1) * side[1] + Math.sin(theta1) * up2[1]);
    const bz1 = coneBase[2] + coneRadius * (Math.cos(theta1) * side[2] + Math.sin(theta1) * up2[2]);
    const bx2 = coneBase[0] + coneRadius * (Math.cos(theta2) * side[0] + Math.sin(theta2) * up2[0]);
    const by2 = coneBase[1] + coneRadius * (Math.cos(theta2) * side[1] + Math.sin(theta2) * up2[1]);
    const bz2 = coneBase[2] + coneRadius * (Math.cos(theta2) * side[2] + Math.sin(theta2) * up2[2]);
    // Draw lines around base circle
    coneVerts.push(
      bx1, by1, bz1, ...colorTip, bx2, by2, bz2, ...colorTip
    );
    // Draw lines from base to tip
    coneVerts.push(
      bx1, by1, bz1, ...colorTip, coneTip[0], coneTip[1], coneTip[2], ...colorTip
    );
  }
  const coneBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, coneBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(coneVerts), gl.STREAM_DRAW);
  gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 24, 0);
  gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 24, 12);
  gl.drawArrays(gl.LINES, 0, coneVerts.length / 6);
}

function multiplyMatrixVec(matrix, vec) {
  // matrix: n x 3, vec: [x, y, z] -> returns [mx, my, mz]
  let result = [0, 0, 0];
  for (let i = 0; i < matrix.length; ++i) {
    result[0] += matrix[i][0] * vec[i];
    result[1] += matrix[i][1] * vec[i];
    result[2] += matrix[i][2] * vec[i];
  }
  return result;
}

// --- Multiple vectors input as interactive table ---
const vectorsTable = document.getElementById('vectorsTable');
const addVectorRow = document.getElementById('addVectorRow');
let vectors = [
  { value: [0.6, 0.6, 0.6], show: true, showTrans: true }
];

function renderVectorsTable() {
  if (!vectorsTable) return;
  const tbody = vectorsTable.querySelector('tbody');
  tbody.innerHTML = '';
  for (let i = 0; i < vectors.length; ++i) {
    const row = document.createElement('tr');
    // Show vector toggle
    let showCell = document.createElement('td');
    let showChk = document.createElement('input');
    showChk.type = 'checkbox';
    showChk.checked = vectors[i].show;
    showChk.title = "Show vector";
    showChk.addEventListener('change', () => {
      vectors[i].show = showChk.checked;
      drawScene();
    });
    showCell.appendChild(showChk);
    row.appendChild(showCell);

    // Vector input fields
    for (let j = 0; j < 3; ++j) {
      let cell = document.createElement('td');
      cell.style.padding = '2px';
      let input = document.createElement('input');
      input.type = 'number';
      input.step = 'any';
      input.value = vectors[i].value[j] ?? '';
      input.style.width = '48px';
      input.addEventListener('input', () => {
        const val = parseFloat(input.value);
        vectors[i].value[j] = isFinite(val) ? val : 0;
        drawScene();
      });
      cell.appendChild(input);
      row.appendChild(cell);
    }

    // Show transformed vector toggle
    let showTransCell = document.createElement('td');
    let showTransChk = document.createElement('input');
    showTransChk.type = 'checkbox';
    showTransChk.checked = vectors[i].showTrans;
    showTransChk.title = "Show transformed";
    showTransChk.addEventListener('change', () => {
      vectors[i].showTrans = showTransChk.checked;
      drawScene();
    });
    showTransCell.appendChild(showTransChk);
    row.appendChild(showTransCell);

    // Remove row button
    let delCell = document.createElement('td');
    if (vectors.length > 1) {
      let delBtn = document.createElement('button');
      delBtn.textContent = '–';
      delBtn.type = 'button';
      delBtn.style.width = '22px';
      delBtn.style.marginLeft = '4px';
      delBtn.onclick = () => {
        vectors.splice(i, 1);
        renderVectorsTable();
        drawScene();
      };
      delCell.appendChild(delBtn);
    }
    row.appendChild(delCell);

    tbody.appendChild(row);
  }
}
if (vectorsTable) renderVectorsTable();
if (addVectorRow) {
  addVectorRow.onclick = () => {
    vectors.push({ value: [0, 0, 0], show: true, showTrans: true });
    renderVectorsTable();
    drawScene();
  };
}

// Utility: assign a color for each vector index
function getVectorColor(idx) {
  // Use a set of visually distinct colors, cycle if needed
  const colors = [
    [1, 0.5, 0],    // orange
    [0.2, 0.6, 1],  // blue
    [0.2, 0.8, 0.2],// green
    [0.8, 0.2, 0.8],// magenta
    [0.8, 0.8, 0.2],// yellow
    [0.5, 0.2, 0.8],// purple
    [0.2, 0.8, 0.7],// teal
    [0.8, 0.4, 0.2],// brown
  ];
  return colors[idx % colors.length];
}

function lightenColor(color, factor = 0.5) {
  // Blend color with white by the given factor (0 = original, 1 = white)
  return color.map(c => c + (1 - c) * factor);
}

function drawScene() {
  gl.clearColor(1, 1, 1, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.useProgram(program);

  gl.enableVertexAttribArray(aPosition);
  gl.enableVertexAttribArray(aColor);

  // --- Draw grid (extent controlled by slider) ---
  const gridStep = 0.2;
  const min = -gridExtent;
  const max = gridExtent;
  const gridLines = [];
  for (let i = min; i <= max; i++) {
    // Minor grid lines
    gridLines.push(
      min * gridStep, 0, i * gridStep, 0.85, 0.85, 0.85,
      max * gridStep, 0, i * gridStep, 0.85, 0.85, 0.85
    );
    gridLines.push(
      i * gridStep, 0, min * gridStep, 0.85, 0.85, 0.85,
      i * gridStep, 0, max * gridStep, 0.85, 0.85, 0.85
    );
    // Major grid lines (darker)
    if (i % 5 === 0) {
      gridLines.push(
        min * gridStep, 0, i * gridStep, 0.6, 0.6, 0.6,
        max * gridStep, 0, i * gridStep, 0.6, 0.6, 0.6
      );
      gridLines.push(
        i * gridStep, 0, min * gridStep, 0.6, 0.6, 0.6,
        i * gridStep, 0, max * gridStep, 0.6, 0.6, 0.6
      );
    }
  }
  const gridVertices = new Float32Array(gridLines);

  const gridBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, gridBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, gridVertices, gl.STREAM_DRAW);

  // Draw grid (with alpha)
  gl.bindBuffer(gl.ARRAY_BUFFER, gridBuffer);
  gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 24, 0);
  gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 24, 12);
  gl.uniformMatrix4fv(uMVP, false, getMVPMatrix());
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.drawArrays(gl.LINES, 0, gridVertices.length / 6);
  gl.disable(gl.BLEND);

  // Draw axes (if enabled)
  if (showAxes) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 24, 0);
    gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 24, 12);
    gl.uniformMatrix4fv(uMVP, false, getMVPMatrix());
    gl.drawArrays(gl.LINES, 0, 6);
  }

  // Draw user vectors (colored) and their transformed vectors (teal)
  if (vectors && vectors.length > 0) {
    for (let i = 0; i < vectors.length; ++i) {
      const v = vectors[i].value;
      const color = getVectorColor(i);
      // Draw original vector
      if (vectors[i].show) {
        if (showArrow3d) {
          drawCylinderAndCone(
            [0, 0, 0],
            [v[0], v[1], v[2]],
            color, // shaft color
            color.map(x => x * 0.7) // tip color, slightly darker
          );
        } else {
          let vec = [0, 0, 0, ...color, v[0], v[1], v[2], ...color];
          const vecBuffer = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, vecBuffer);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vec), gl.STREAM_DRAW);
          gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 24, 0);
          gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 24, 12);
          gl.drawArrays(gl.LINES, 0, 2);
        }
      }
      // Draw transformed vector
      if (vectors[i].showTrans && matrixVectors && matrixVectors.length > 0) {
        // Use this vector as input to the matrix
        const inputVec = [];
        for (let j = 0; j < matrixVectors.length; ++j) {
          inputVec.push(v[j] !== undefined ? v[j] : 0);
        }
        const out = multiplyMatrixVec(matrixVectors, inputVec);
        // Use a teal color for all transformed vectors, but with a slight tint per vector
        const baseTeal = [0, 0.7, 0.7];
        const tint = getVectorColor(i).map((c, j) => baseTeal[j] * 0.7 + c * 0.3);
        if (showArrow3d) {
          drawCylinderAndCone(
            [0, 0, 0],
            [out[0], out[1], out[2]],
            tint,
            tint.map(x => x * 0.7)
          );
        } else {
          let outVec = [0, 0, 0, ...tint, out[0], out[1], out[2], ...tint];
          const outBuffer = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, outBuffer);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(outVec), gl.STREAM_DRAW);
          gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 24, 0);
          gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 24, 12);
          gl.drawArrays(gl.LINES, 0, 2);
        }
      }
    }
    // For "show components", show for every vector in the list (including the default/orange one)
    if (showComponents && vectors.length > 0) {
      for (let i = 0; i < vectors.length; ++i) {
        const v = vectors[i].value;
        // Use a lighter version of the vector's color
        const color = lightenColor(getVectorColor(i), 0.5);
        const proj = [v[0], 0, v[2]];
        let comp1 = [0, 0, 0, ...color, proj[0], 0, proj[2], ...color];
        let comp2 = [proj[0], 0, proj[2], ...color, v[0], v[1], v[2], ...color];
        // Draw projection vector
        const comp1Buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, comp1Buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(comp1), gl.STREAM_DRAW);
        gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 24, 0);
        gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 24, 12);
        gl.drawArrays(gl.LINES, 0, 2);
        // Draw vertical component
        const comp2Buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, comp2Buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(comp2), gl.STREAM_DRAW);
        gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 24, 0);
        gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 24, 12);
        gl.drawArrays(gl.LINES, 0, 2);
      }
    }
  }

  // Draw matrix vectors (purple)
  if (matrixVectors && matrixVectors.length > 0) {
    for (const v of matrixVectors) {
      let vec = [0, 0, 0, 0.5, 0, 0.7, v[0], v[1], v[2], 0.5, 0, 0.7];
      const vecBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vecBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vec), gl.STREAM_DRAW);
      gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 24, 0);
      gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 24, 12);
      gl.drawArrays(gl.LINES, 0, 2);
    }
  }

  // Draw output vector (matrix * input vector) in teal
  if (matrixVectors && matrixVectors.length > 0) {
    // Use the input vector as a column vector of length n
    // If not enough elements, pad with zeros; if too many, ignore extras
    const inputVec = [];
    for (let i = 0; i < matrixVectors.length; ++i) {
      inputVec.push(vector[i] !== undefined ? vector[i] : 0);
    }
    const out = multiplyMatrixVec(matrixVectors, inputVec);
    if (showArrow3d) {
      drawCylinderAndCone(
        [0, 0, 0],
        [out[0], out[1], out[2]],
        [0, 0.7, 0.7], // shaft color
        [0, 0.5, 0.7]  // tip color
      );
    } else {
      let outVec = [0, 0, 0, 0, 0.7, 0.7, out[0], out[1], out[2], 0, 0.7, 0.7];
      const outBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, outBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(outVec), gl.STREAM_DRAW);
      gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 24, 0);
      gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 24, 12);
      gl.drawArrays(gl.LINES, 0, 2);
    }
  }

  // Draw component vectors if enabled
  if (showComponents) {
    // Projection onto xz plane (shadow)
    const proj = [vector[0], 0, vector[2]];
    // From origin to projection (blue)
    let comp1 = [0, 0, 0, 0.2, 0.2, 1, proj[0], 0, proj[2], 0.2, 0.2, 1];
    // From projection up to vector (green)
    let comp2 = [proj[0], 0, proj[2], 0, 0.7, 0, vector[0], vector[1], vector[2], 0, 0.7, 0];

    // Draw projection vector (blue)
    const comp1Buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, comp1Buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(comp1), gl.STREAM_DRAW);
    gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 24, 0);
    gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 24, 12);
    gl.drawArrays(gl.LINES, 0, 2);

    // Draw vertical component (green)
    const comp2Buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, comp2Buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(comp2), gl.STREAM_DRAW);
    gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 24, 0);
    gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 24, 12);
    gl.drawArrays(gl.LINES, 0, 2);
  }

  // Debug info
  if (debugInfo) {
    if (debugMode) {
      // Show info for all vectors
      let lines = [];
      for (let i = 0; i < vectors.length; ++i) {
        const v = vectors[i].value;
        const color = getVectorColor(i);
        const colorBox = `<span style="display:inline-block;width:1em;height:1em;background:rgb(${Math.round(color[0]*255)},${Math.round(color[1]*255)},${Math.round(color[2]*255)});margin-right:2px;border-radius:2px;vertical-align:middle;"></span>`;
        const len = Math.hypot(v[0], v[1], v[2]);
        let line = `${colorBox}<b>v${i+1}</b> = (${v.map(x => x.toFixed(4)).join(', ')}) |v|=${len.toFixed(4)}`;
        // If transformed vector is shown, show its value too
        if (vectors[i].showTrans && matrixVectors && matrixVectors.length > 0) {
          const inputVec = [];
          for (let j = 0; j < matrixVectors.length; ++j) {
            inputVec.push(v[j] !== undefined ? v[j] : 0);
          }
          const out = multiplyMatrixVec(matrixVectors, inputVec);
          const outLen = Math.hypot(out[0], out[1], out[2]);
          line += ` → (${out.map(x => x.toFixed(4)).join(', ')}) |out|=${outLen.toFixed(4)}`;
        }
        lines.push(line);
      }
      debugInfo.innerHTML = lines.join('<br>');
    } else {
      debugInfo.innerHTML = '';
    }
  }

  gl.disableVertexAttribArray(aPosition);
  gl.disableVertexAttribArray(aColor);
}

let rotationY = 0;
let rotationX = 0; // vertical orbit
let isDragging = false;
let isRightDragging = false;
let isMiddleDragging = false;
let lastX = 0;
let lastY = 0;
let zoom = 1.0; // 1.0 = default, <1 = zoom out, >1 = zoom in

canvas.addEventListener('mousedown', (e) => {
  if (e.button === 0) {
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  } else if (e.button === 2) {
    isRightDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  } else if (e.button === 1) {
    isMiddleDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  }
});
window.addEventListener('mousemove', (e) => {
  // Use 1 or -1 for direction based on toggles
  const hSign = invertH ? -1 : 1;
  const vSign = invertV ? -1 : 1;
  if (isDragging) {
    const dx = e.clientX - lastX;
    rotationY += hSign * dx * 0.01;
    lastX = e.clientX;
    lastY = e.clientY;
    drawScene();
  } else if (isRightDragging) {
    const dy = e.clientY - lastY;
    rotationX += vSign * dy * 0.01;
    rotationX = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, rotationX));
    lastX = e.clientX;
    lastY = e.clientY;
    drawScene();
  } else if (isMiddleDragging) {
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    rotationY += hSign * dx * 0.01;
    rotationX += vSign * dy * 0.01;
    rotationX = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, rotationX));
    lastX = e.clientX;
    lastY = e.clientY;
    drawScene();
  }
});
window.addEventListener('mouseup', () => {
  isDragging = false;
  isRightDragging = false;
  isMiddleDragging = false;
});
canvas.addEventListener('contextmenu', e => e.preventDefault());

// Zoom with scroll (support both 'wheel' and 'gesture' events)
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  // Try a much larger sensitivity for touchpads
  let delta = e.deltaY;
  if (e.deltaMode === 1) { // DOM_DELTA_LINE
    delta *= 16;
  } else if (e.deltaMode === 2) { // DOM_DELTA_PAGE
    delta *= 120;
  }
  zoom *= Math.exp(-delta * 0.05); // much higher sensitivity
  // No clamping of zoom
  drawScene();
}, { passive: false });

// For pinch gesture support (Safari, some browsers)
canvas.addEventListener('gesturechange', (e) => {
  e.preventDefault();
  zoom /= e.scale;
  // No clamping of zoom
  drawScene();
}, { passive: false });

const invertHorizontal = document.getElementById('invertHorizontal');
const invertVertical = document.getElementById('invertVertical');
let invertH = false;
let invertV = false;
if (invertHorizontal) {
  invertH = invertHorizontal.checked;
  invertHorizontal.addEventListener('change', () => {
    invertH = invertHorizontal.checked;
  });
}
if (invertVertical) {
  invertV = invertVertical.checked;
  invertVertical.addEventListener('change', () => {
    invertV = invertVertical.checked;
  });
}

const axisCheckbox = document.getElementById('axisCheckbox');
let showAxes = true;
if (axisCheckbox) {
  showAxes = axisCheckbox.checked;
  axisCheckbox.addEventListener('change', () => {
    showAxes = axisCheckbox.checked;
    drawScene();
  });
}

const arrow3dCheckbox = document.getElementById('arrow3dCheckbox');
let showArrow3d = true;
if (arrow3dCheckbox) {
  showArrow3d = arrow3dCheckbox.checked;
  arrow3dCheckbox.addEventListener('change', () => {
    showArrow3d = arrow3dCheckbox.checked;
    drawScene();
  });
}

const componentButton = document.getElementById('componentButton');
let showComponents = false;
if (componentButton) {
  componentButton.addEventListener('click', () => {
    showComponents = !showComponents;
    componentButton.textContent = showComponents ? "Hide components" : "Show components";
    drawScene();
  });
}

const debugCheckbox = document.getElementById('debugCheckbox');
const debugInfo = document.getElementById('debugInfo');
let debugMode = false;
if (debugCheckbox) {
  debugMode = debugCheckbox.checked;
  debugCheckbox.addEventListener('change', () => {
    debugMode = debugCheckbox.checked;
    drawScene();
  });
}

drawScene();
