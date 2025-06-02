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
  // --- Use window.rotationX and window.rotationY for camera ---
  const r = 3;
  const elev = typeof window.rotationX === 'number' ? window.rotationX : 0;
  const azim = typeof window.rotationY === 'number' ? window.rotationY : 0;
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
    typeof window.zoom === 'number' ? window.zoom : 1, 0,    0,    0,
    0,    typeof window.zoom === 'number' ? window.zoom : 1, 0,    0,
    0,    0,    typeof window.zoom === 'number' ? window.zoom : 1, 0,
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
  [0.5, 0, 0],
  [0, 0.5, 0],
  [0, 0, 0.5]
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

// --- Sidebar open/close logic ---
const vectorSidebar = document.getElementById('vectorSidebar');
const openSidebarBtn = document.getElementById('openSidebarBtn');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const mobileCloseBtn = vectorSidebar ? vectorSidebar.querySelector('.mobile-close-btn') : null;
function updateSidebarButtons() {
  // No need to flip/fade, just let CSS handle visibility and animation
}
function closeSidebar() {
  vectorSidebar.classList.remove('open');
  if (sidebarOverlay) {
    sidebarOverlay.style.display = 'none';
    sidebarOverlay.style.opacity = '0';
    sidebarOverlay.style.pointerEvents = 'none';
  }
  if (window.innerWidth < 700) {
    const controlsPanel = document.getElementById('controlsPanel');
    if (controlsPanel) controlsPanel.style.display = '';
  }
}
if (vectorSidebar && openSidebarBtn && closeSidebarBtn) {
  openSidebarBtn.onclick = () => {
    vectorSidebar.classList.add('open');
    if (sidebarOverlay) {
      sidebarOverlay.style.display = 'block';
      sidebarOverlay.style.opacity = '1';
      sidebarOverlay.style.pointerEvents = 'auto';
    }
    // On mobile, hide controls panel when sidebar is open
    if (window.innerWidth < 700) {
      const controlsPanel = document.getElementById('controlsPanel');
      if (controlsPanel) controlsPanel.style.display = 'none';
    }
  };
  closeSidebarBtn.onclick = closeSidebar;
  window.addEventListener('keydown', (e) => {
    if (e.key === "Escape") {
      closeSidebar();
    }
  });
}
if (sidebarOverlay) {
  sidebarOverlay.onclick = closeSidebar;
}
// Mobile close button logic
if (mobileCloseBtn) {
  mobileCloseBtn.onclick = closeSidebar;
}

// --- Multiple vectors input as interactive table ---
// Use the sidebar's vectorsTable and addVectorRow
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
    [1, 0.5, 0],      // orange
    [0.2, 0.6, 1],    // blue
    [0.2, 0.8, 0.2],  // green
    [0.8, 0.2, 0.8],  // magenta
    [0.8, 0.8, 0.2],  // yellow
    [0.5, 0.2, 0.8],  // purple
    [0.2, 0.8, 0.7],  // teal
    [0.8, 0.4, 0.2],  // brown
    [0.9, 0.1, 0.1],  // red
    [0.1, 0.1, 0.9],  // deep blue
    [0.1, 0.7, 0.5],  // turquoise
    [0.7, 0.1, 0.5],  // pinkish purple
    [0.6, 0.6, 0.1],  // olive
    [0.1, 0.6, 0.6],  // cyan
    [0.7, 0.3, 0.1],  // burnt orange
    [0.3, 0.7, 0.1],  // lime green
    [0.6, 0.1, 0.3],  // raspberry
    [0.1, 0.3, 0.7],  // steel blue
    [0.7, 0.7, 0.7],  // light gray
    [0.3, 0.3, 0.3],  // dark gray
  ];
  return colors[idx % colors.length];
}

// --- Add missing lightenColor function ---
function lightenColor(color, factor = 0.5) {
  // Blend color with white by the given factor (0 = original, 1 = white)
  return color.map(c => c + (1 - c) * factor);
}

// --- Get current theme (for grid/canvas background) ---
function isDarkMode() {
  if (document.body.classList.contains('theme-dark')) return true;
  if (document.body.classList.contains('theme-light')) return false;
  // Auto: use system
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// --- Project 3D point to 2D canvas coordinates ---
function projectToCanvas(x, y, z, mvp, width, height) {
  // Transform the point by the MVP matrix
  const clipSpace = [
    mvp[0] * x + mvp[4] * y + mvp[8] * z + mvp[12],
    mvp[1] * x + mvp[5] * y + mvp[9] * z + mvp[13],
    mvp[2] * x + mvp[6] * y + mvp[10] * z + mvp[14],
    mvp[3] * x + mvp[7] * y + mvp[11] * z + mvp[15],
  ];

  // Perform perspective division
  const ndc = clipSpace.map(c => c / clipSpace[3]);

  // Convert to window coordinates
  const x2d = (ndc[0] * 0.5 + 0.5) * width;
  const y2d = (ndc[1] * -0.5 + 0.5) * height;

  return [x2d, y2d];
}

// --- Draggable vector tips ---
// Move these lines up so they're defined before drawScene uses them
const vectorTipDivs = [];
function clearVectorTipDivs() {
  for (const div of vectorTipDivs) {
    if (div.parentNode) div.parentNode.removeChild(div);
  }
  vectorTipDivs.length = 0;
}

// --- Modify drawScene to add draggable points ---
function drawScene() {
  // --- Set canvas background color based on theme ---
  if (isDarkMode()) {
    gl.clearColor(0.09, 0.10, 0.11, 1); // #181a1b
  } else {
    gl.clearColor(1, 1, 1, 1);
  }
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.useProgram(program);

  gl.enableVertexAttribArray(aPosition);
  gl.enableVertexAttribArray(aColor);

  // --- Draw grid (extent controlled by slider) ---
  const gridStep = 0.2;
  const min = -gridExtent;
  const max = gridExtent;
  const gridLines = [];
  // --- Choose grid colors based on theme ---
  const gridMinor = isDarkMode() ? [0.22, 0.22, 0.22] : [0.85, 0.85, 0.85];
  const gridMajor = isDarkMode() ? [0.38, 0.38, 0.38] : [0.6, 0.6, 0.6];
  for (let i = min; i <= max; i++) {
    // Minor grid lines
    gridLines.push(
      min * gridStep, 0, i * gridStep, ...gridMinor,
      max * gridStep, 0, i * gridStep, ...gridMinor
    );
    gridLines.push(
      i * gridStep, 0, min * gridStep, ...gridMinor,
      i * gridStep, 0, max * gridStep, ...gridMinor
    );
    // Major grid lines (darker)
    if (i % 5 === 0) {
      gridLines.push(
        min * gridStep, 0, i * gridStep, ...gridMajor,
        max * gridStep, 0, i * gridStep, ...gridMajor
      );
      gridLines.push(
        i * gridStep, 0, min * gridStep, ...gridMajor,
        i * gridStep, 0, max * gridStep, ...gridMajor
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
        // Use a slightly darker version of the main vector's color
        const baseColor = getVectorColor(i);
        const darkColor = baseColor.map(x => x * 0.7);
        if (showArrow3d) {
          drawCylinderAndCone(
            [0, 0, 0],
            [out[0], out[1], out[2]],
            darkColor,
            darkColor.map(x => x * 0.7)
          );
        } else {
          let outVec = [0, 0, 0, ...darkColor, out[0], out[1], out[2], ...darkColor];
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

        // --- Show components for transformed vector as well ---
        if (matrixVectors && matrixVectors.length > 0 && vectors[i].showTrans) {
          // Compute transformed vector
          const inputVec = [];
          for (let j = 0; j < matrixVectors.length; ++j) {
            inputVec.push(v[j] !== undefined ? v[j] : 0);
          }
          const out = multiplyMatrixVec(matrixVectors, inputVec);
          // Use a lighter/darker version of the transformed vector's color
          const tColor = lightenColor(getVectorColor(i).map(x => x * 0.7), 0.5);
          const tProj = [out[0], 0, out[2]];
          let tComp1 = [0, 0, 0, ...tColor, tProj[0], 0, tProj[2], ...tColor];
          let tComp2 = [tProj[0], 0, tProj[2], ...tColor, out[0], out[1], out[2], ...tColor];
          // Draw transformed projection vector
          const tComp1Buffer = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, tComp1Buffer);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tComp1), gl.STREAM_DRAW);
          gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 24, 0);
          gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 24, 12);
          gl.drawArrays(gl.LINES, 0, 2);
          // Draw transformed vertical component
          const tComp2Buffer = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, tComp2Buffer);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tComp2), gl.STREAM_DRAW);
          gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 24, 0);
          gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 24, 12);
          gl.drawArrays(gl.LINES, 0, 2);
        }
      }
    }
  }

  // Draw matrix vectors (purple)
  if (showMatrixVectors && matrixVectors && matrixVectors.length > 0) {
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

  // --- Draggable vector tips ---
  clearVectorTipDivs();
  const mvp = getMVPMatrix();
  if (showDraggableTips && vectors && vectors.length > 0) {
    for (let i = 0; i < vectors.length; ++i) {
      if (!vectors[i].show) continue;
      const v = vectors[i].value;
      const tip2d = projectToCanvas(v[0], v[1], v[2], mvp, canvas.width, canvas.height);
      if (!tip2d) continue;
      const [cx, cy] = tip2d;
      // Create draggable div
      const div = document.createElement('div');
      // Use canvas.getBoundingClientRect() for correct placement
      const rect = canvas.getBoundingClientRect();
      div.style.position = 'absolute';
      div.style.left = `${rect.left + window.scrollX + cx - 9}px`;
      div.style.top = `${rect.top + window.scrollY + cy - 9}px`;
      div.style.width = '18px';
      div.style.height = '18px';
      div.style.borderRadius = '50%';
      div.style.background = `rgba(${Math.round(getVectorColor(i)[0]*255)},${Math.round(getVectorColor(i)[1]*255)},${Math.round(getVectorColor(i)[2]*255)},0.85)`;
      div.style.border = '2px solid #fff';
      div.style.boxShadow = '0 1px 6px 0 rgba(0,0,0,0.12)';
      div.style.cursor = 'pointer';
      div.style.zIndex = 9;
      div.title = 'Drag to move vector tip';
      div.draggable = false;
      div.className = 'vector-tip-draggable';

      // Drag logic
      let dragging = false;
      let origVec = null;
      let origMouse = null;

      div.addEventListener('mousedown', (e) => {
        e.preventDefault();
        dragging = true;
        origVec = [v[0], v[1], v[2]];
        // Mouse position relative to canvas
        const rect = canvas.getBoundingClientRect();
        origMouse = [
          e.clientX - rect.left,
          e.clientY - rect.top
        ];
        document.body.style.userSelect = 'none';

        function onDragMove(ev) {
          if (!dragging) return;
          // Mouse position relative to canvas
          const rect = canvas.getBoundingClientRect();
          const mx = ev.clientX - rect.left;
          const my = ev.clientY - rect.top;
          const dx = mx - origMouse[0];
          const dy = my - origMouse[1];
          // Move in screen space, then unproject to world
          const tip2dNow = projectToCanvas(origVec[0], origVec[1], origVec[2], mvp, canvas.width, canvas.height);
          if (!tip2dNow) return;
          const [sx, sy] = tip2dNow;
          const nx = sx + dx;
          const ny = sy + dy;
          // Unproject: find world coordinates at the same depth as original tip
          const ndcX = (nx / canvas.width) * 2 - 1;
          const ndcY = -((ny / canvas.height) * 2 - 1);
          // Invert MVP
          const invMVP = invertMatrix4(mvp);
          if (!invMVP) return;
          // Get original tip's NDC z
          const px = origVec[0], py = origVec[1], pz = origVec[2], pw = 1;
          const nx0 =
            mvp[0] * px + mvp[4] * py + mvp[8] * pz + mvp[12] * pw;
          const ny0 =
            mvp[1] * px + mvp[5] * py + mvp[9] * pz + mvp[13] * pw;
          const nz0 =
            mvp[2] * px + mvp[6] * py + mvp[10] * pz + mvp[14] * pw;
          const nw0 =
            mvp[3] * px + mvp[7] * py + mvp[11] * pz + mvp[15] * pw;
          const ndcZ = nw0 !== 0 ? nz0 / nw0 : 0;
          // Unproject
          const world = unprojectFromNDC(ndcX, ndcY, ndcZ, invMVP);
          if (!world) return;
          vectors[i].value = [world[0], world[1], world[2]];
          renderVectorsTable();
          drawScene();
        }
        function onDragEnd() {
          if (dragging) {
            dragging = false;
            document.body.style.userSelect = '';
            window.removeEventListener('mousemove', onDragMove);
            window.removeEventListener('mouseup', onDragEnd);
          }
        }
        window.addEventListener('mousemove', onDragMove);
        window.addEventListener('mouseup', onDragEnd);
      });

      document.body.appendChild(div);
      vectorTipDivs.push(div);
    }
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

// 4x4 matrix inversion (for MVP)
function invertMatrix4(m) {
  const inv = new Float32Array(16);
  const m00 = m[0], m01 = m[1], m02 = m[2], m03 = m[3];
  const m10 = m[4], m11 = m[5], m12 = m[6], m13 = m[7];
  const m20 = m[8], m21 = m[9], m22 = m[10], m23 = m[11];
  const m30 = m[12], m31 = m[13], m32 = m[14], m33 = m[15];

  const det =
    m00 * m11 * m22 * m33 - m00 * m11 * m23 * m32 - m00 * m12 * m21 * m33 +
    m00 * m12 * m23 * m31 + m00 * m13 * m21 * m32 - m00 * m13 * m22 * m31 -
    m01 * m10 * m22 * m33 + m01 * m10 * m23 * m32 + m01 * m12 * m20 * m33 -
    m01 * m12 * m23 * m30 - m01 * m13 * m20 * m32 + m01 * m13 * m22 * m30 +
    m02 * m10 * m21 * m33 - m02 * m10 * m23 * m31 - m02 * m11 * m20 * m33 +
    m02 * m11 * m23 * m30 + m02 * m13 * m20 * m31 - m02 * m13 * m21 * m30 -
    m03 * m10 * m21 * m32 + m03 * m10 * m22 * m31 + m03 * m11 * m20 * m32 -
    m03 * m11 * m22 * m30 - m03 * m12 * m20 * m31 + m03 * m12 * m21 * m30;

  if (Math.abs(det) < 1e-6) return null; // Singular matrix

  const invDet = 1 / det;
  inv[0] = (m11 * m22 * m33 - m11 * m23 * m32 - m21 * m12 * m33 +
    m21 * m13 * m32 + m31 * m12 * m23 - m31 * m13 * m22) * invDet;
  inv[1] = (-m01 * m22 * m33 + m01 * m23 * m32 + m21 * m02 * m33 -
    m21 * m03 * m32 - m31 * m02 * m23 + m31 * m03 * m22) * invDet;
  inv[2] = (m01 * m12 * m33 - m01 * m13 * m32 - m11 * m02 * m33 +
    m11 * m03 * m32 + m31 * m02 * m13 - m31 * m03 * m12) * invDet;
  inv[3] = (-m01 * m12 * m23 + m01 * m13 * m22 + m11 * m02 * m23 -
    m11 * m03 * m22 - m21 * m02 * m13 + m21 * m03 * m12) * invDet;

  inv[4] = (-m10 * m22 * m33 + m10 * m23 * m32 + m20 * m12 * m33 -
    m20 * m13 * m32 - m30 * m12 * m23 + m30 * m13 * m22) * invDet;
  inv[5] = (m00 * m22 * m33 - m00 * m23 * m32 - m20 * m02 * m33 +
    m20 * m03 * m32 + m30 * m02 * m23 - m30 * m03 * m22) * invDet;
  inv[6] = (-m00 * m12 * m33 + m00 * m13 * m32 + m10 * m02 * m33 -
    m10 * m03 * m32 - m30 * m02 * m13 + m30 * m03 * m12) * invDet;
  inv[7] = (m00 * m12 * m23 - m00 * m13 * m22 - m10 * m02 * m23 +
    m10 * m03 * m22 + m20 * m02 * m13 - m20 * m03 * m12) * invDet;

  inv[8] = (m10 * m21 * m33 - m10 * m23 * m31 - m20 * m11 * m33 +
    m20 * m13 * m31 + m30 * m11 * m23 - m30 * m13 * m21) * invDet;
  inv[9] = (-m00 * m21 * m33 + m00 * m23 * m31 + m20 * m01 * m33 -
    m20 * m03 * m31 - m30 * m01 * m23 + m30 * m03 * m21) * invDet;
  inv[10] = (m00 * m11 * m33 - m00 * m13 * m31 - m10 * m01 * m33 +
    m10 * m03 * m31 + m30 * m01 * m13 - m30 * m03 * m11) * invDet;
  inv[11] = (-m00 * m11 * m23 + m00 * m13 * m21 + m10 * m01 * m23 -
    m10 * m03 * m21 - m20 * m01 * m13 + m20 * m03 * m11) * invDet;

  inv[12] = (-m10 * m21 * m32 + m10 * m22 * m31 + m20 * m11 * m32 -
    m20 * m12 * m31 - m30 * m11 * m22 + m30 * m12 * m21) * invDet;
  inv[13] = (m00 * m21 * m32 - m00 * m22 * m31 - m20 * m01 * m32 +
    m20 * m02 * m31 + m30 * m01 * m22 - m30 * m02 * m21) * invDet;
  inv[14] = (-m00 * m11 * m32 + m00 * m12 * m31 + m10 * m01 * m32 -
    m10 * m02 * m31 - m30 * m01 * m12 + m30 * m02 * m11) * invDet;
  inv[15] = (m00 * m11 * m22 - m00 * m12 * m21 - m10 * m01 * m22 +
    m10 * m02 * m21 + m20 * m01 * m12 - m20 * m02 * m11) * invDet;

  return inv;
}

// Unproject from NDC to world coordinates
function unprojectFromNDC(ndcX, ndcY, ndcZ, invMVP) {
  // Homogeneous clip coordinates
  const clip = [ndcX, ndcY, ndcZ, 1];
  // Multiply by inverse MVP matrix
  const world = [
    invMVP[0] * clip[0] + invMVP[4] * clip[1] + invMVP[8] * clip[2] + invMVP[12] * clip[3],
    invMVP[1] * clip[0] + invMVP[5] * clip[1] + invMVP[9] * clip[2] + invMVP[13] * clip[3],
    invMVP[2] * clip[0] + invMVP[6] * clip[1] + invMVP[10] * clip[2] + invMVP[14] * clip[3],
    invMVP[3] * clip[0] + invMVP[7] * clip[1] + invMVP[11] * clip[2] + invMVP[15] * clip[3],
  ];
  // Perspective divide
  const w = world[3];
  return w !== 0 ? world.map(c => c / w) : world;
}

let rotationY = 0;
let rotationX = 0; // vertical orbit
let isDragging = false;
let isRightDragging = false;
let isMiddleDragging = false;
let lastX = 0;
let lastY = 0;
let zoom = 1.0; // 1.0 = default, <1 = zoom out, >1 = zoom in

// --- Add min/max zoom limits ---
const MIN_ZOOM = 0.01;
const MAX_ZOOM = 10;

// --- Sync window globals for mobile.js ---
window.rotationX = rotationX;
window.rotationY = rotationY;
window.zoom = zoom;

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
    window.rotationY = rotationY;
    window.rotationX = rotationX;
    window.zoom = zoom;
    drawScene();
  } else if (isRightDragging) {
    const dy = e.clientY - lastY;
    rotationX += vSign * dy * 0.01;
    rotationX = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, rotationX));
    lastX = e.clientX;
    lastY = e.clientY;
    window.rotationY = rotationY;
    window.rotationX = rotationX;
    window.zoom = zoom;
    drawScene();
  } else if (isMiddleDragging) {
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    rotationY += hSign * dx * 0.01;
    rotationX += vSign * dy * 0.01;
    rotationX = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, rotationX));
    lastX = e.clientX;
    lastY = e.clientY;
    window.rotationY = rotationY;
    window.rotationX = rotationX;
    window.zoom = zoom;
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
  let delta = e.deltaY;
  if (e.deltaMode === 1) { // DOM_DELTA_LINE
    delta *= 16;
  } else if (e.deltaMode === 2) { // DOM_DELTA_PAGE
    delta *= 120;
  }
  // Invert zoom direction if needed
  if (invertZoom) delta = -delta;
  zoom *= Math.exp(-delta * 0.05);
  // --- Clamp zoom ---
  zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
  window.zoom = zoom;
  drawScene();
}, { passive: false });

// For pinch gesture support (Safari, some browsers)
canvas.addEventListener('gesturechange', (e) => {
  e.preventDefault();
  // Invert zoom direction if needed
  zoom *= invertZoom ? e.scale : 1 / e.scale;
  // --- Clamp zoom ---
  zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
  window.zoom = zoom;
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

// --- Matrix vectors toggle ---
const showMatrixVectorsCheckbox = document.getElementById('showMatrixVectorsCheckbox');
let showMatrixVectors = true;
if (showMatrixVectorsCheckbox) {
  showMatrixVectors = showMatrixVectorsCheckbox.checked;
  showMatrixVectorsCheckbox.addEventListener('change', () => {
    showMatrixVectors = showMatrixVectorsCheckbox.checked;
    drawScene();
  });
}

const componentButton = document.getElementById('componentButton');
let showComponents = true;
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

// Move debug info to bottom left
if (debugInfo) {
  debugInfo.style.position = 'fixed';
  debugInfo.style.left = '0';
  debugInfo.style.bottom = '0';
  debugInfo.style.top = '';
  debugInfo.style.right = '';
  debugInfo.style.background = 'rgba(255,255,255,0.95)';
  debugInfo.style.padding = '8px 12px 8px 8px';
  debugInfo.style.fontSize = '14px';
  debugInfo.style.zIndex = 1000;
  debugInfo.style.borderTopRightRadius = '8px';
  debugInfo.style.borderTopLeftRadius = '';
  debugInfo.style.borderBottomRightRadius = '';
  debugInfo.style.borderBottomLeftRadius = '';
  debugInfo.style.boxShadow = '0 0 8px 0 rgba(0,0,0,0.08)';
}

// --- Draggable vector tips toggle ---
let showDraggableTips = true;
let draggableTipCheckbox = document.getElementById('draggableTipCheckbox');
if (!draggableTipCheckbox) {
  draggableTipCheckbox = document.createElement('input');
  draggableTipCheckbox.type = 'checkbox';
  draggableTipCheckbox.id = 'draggableTipCheckbox';
  draggableTipCheckbox.checked = true;
  const label = document.createElement('label');
  label.htmlFor = 'draggableTipCheckbox';
  label.style.marginLeft = '12px';
  label.appendChild(draggableTipCheckbox);
  label.appendChild(document.createTextNode(' Draggable vector tips'));
  // Insert into controls area or body
  const controls = document.getElementById('controls') || document.body;
  controls.appendChild(label);
}
showDraggableTips = draggableTipCheckbox.checked;
draggableTipCheckbox.addEventListener('change', () => {
  showDraggableTips = draggableTipCheckbox.checked;
  drawScene();
});

// --- Collapsible controls panel ---
const controlsPanel = document.getElementById('controlsPanel');
const controlsContent = document.getElementById('controlsContent');
const toggleControlsBtn = document.getElementById('toggleControlsBtn');
const toggleControlsIcon = document.getElementById('toggleControlsIcon');
let controlsCollapsed = false;

function updateControlsPanel() {
  if (controlsCollapsed) {
    controlsContent.style.display = 'none';
    controlsPanel.style.maxHeight = '44px';
    toggleControlsIcon.innerHTML = '&#9660;'; // Down arrow
  } else {
    controlsContent.style.display = '';
    controlsPanel.style.maxHeight = '';
    toggleControlsIcon.innerHTML = '&#9650;'; // Up arrow
  }
}
if (toggleControlsBtn && controlsPanel && controlsContent && toggleControlsIcon) {
  toggleControlsBtn.onclick = () => {
    controlsCollapsed = !controlsCollapsed;
    updateControlsPanel();
  };
  updateControlsPanel();
}

// --- Invert zoom direction toggle ---
let invertZoomCheckbox = document.getElementById('invertZoomCheckbox');
let invertZoom = invertZoomCheckbox ? invertZoomCheckbox.checked : false;
if (invertZoomCheckbox) {
  invertZoomCheckbox.addEventListener('change', () => {
    invertZoom = invertZoomCheckbox.checked;
  });
}

// --- Theme dropdown logic ---
const themeSelect = document.getElementById('themeSelect');
function applyTheme(theme) {
  document.body.classList.remove('theme-dark', 'theme-light');
  if (theme === 'dark') {
    document.body.classList.add('theme-dark');
  } else if (theme === 'light') {
    document.body.classList.add('theme-light');
  }
  // If 'auto', no class is set, so @media (prefers-color-scheme) applies
}
function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
if (themeSelect) {
  // Set initial dropdown value based on body class or system
  let initial = 'auto';
  if (document.body.classList.contains('theme-dark')) initial = 'dark';
  else if (document.body.classList.contains('theme-light')) initial = 'light';
  themeSelect.value = initial;
  applyTheme(initial);

  themeSelect.addEventListener('change', () => {
    applyTheme(themeSelect.value);
    drawScene(); // <-- Redraw canvas on theme change
  });

  // Listen for system theme changes if in auto mode
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (themeSelect.value === 'auto') {
      applyTheme('auto');
      drawScene(); // <-- Redraw canvas on system theme change
    }
  });
}

drawScene();