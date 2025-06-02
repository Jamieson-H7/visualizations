// Mobile-specific controls for /workspaces/visualizations

(function() {
  // Collapse controls by default
  var controlsPanel = document.getElementById('controlsPanel');
  var controlsContent = document.getElementById('controlsContent');
  var toggleControlsBtn = document.getElementById('toggleControlsBtn');
  var toggleControlsIcon = document.getElementById('toggleControlsIcon');
  var controlsCollapsed = true;
  function updateControlsPanel() {
    if (controlsCollapsed) {
      controlsContent.style.display = 'none';
      controlsPanel.style.maxHeight = '44px';
      toggleControlsIcon.innerHTML = '&#9660;';
    } else {
      controlsContent.style.display = '';
      controlsPanel.style.maxHeight = '';
      toggleControlsIcon.innerHTML = '&#9650;';
    }
  }
  if (toggleControlsBtn && controlsPanel && controlsContent && toggleControlsIcon) {
    toggleControlsBtn.onclick = function() {
      controlsCollapsed = !controlsCollapsed;
      updateControlsPanel();
    };
    updateControlsPanel();
  }

  // Hide debug info by default
  var debugInfo = document.getElementById('debugInfo');
  if (debugInfo) debugInfo.style.display = 'none';
  var debugCheckbox = document.getElementById('debugCheckbox');
  if (debugCheckbox) {
    debugCheckbox.addEventListener('change', function() {
      if (debugInfo) debugInfo.style.display = debugCheckbox.checked ? '' : 'none';
    });
  }

  // Touch drag for rotation (like middle mouse)
  var canvas = document.getElementById('myCanvas');
  if (!canvas) return;
  var lastTouch = null;
  var isRotating = false;
  var pinchStartDist = null;
  var pinchStartZoom = null;
  var script = window; // script.js globals live here

  function getScriptGlobals() {
    // Find the script.js context (globals)
    return window;
  }
  var g = getScriptGlobals();

  // --- Fix: Always allow drag to orbit, even if vector tip is present ---
  let dragTarget = null;
  canvas.addEventListener('touchstart', function(e) {
    // Only start orbit if not touching a vector tip
    if (e.touches.length === 1) {
      // Check if touch is on a vector tip
      let touch = e.touches[0];
      let el = document.elementFromPoint(touch.clientX, touch.clientY);
      if (el && el.classList && el.classList.contains('vector-tip-draggable')) {
        dragTarget = el;
        // Let vector tip handle its own drag
        return;
      }
      isRotating = true;
      lastTouch = { x: touch.clientX, y: touch.clientY };
      dragTarget = null;
    } else if (e.touches.length === 2) {
      isRotating = false;
      pinchStartDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchStartZoom = g.zoom;
      dragTarget = null;
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', function(e) {
    if (dragTarget) return; // let vector tip handle its drag
    if (isRotating && e.touches.length === 1) {
      e.preventDefault();
      var dx = e.touches[0].clientX - lastTouch.x;
      var dy = e.touches[0].clientY - lastTouch.y;
      var hSign = g.invertH ? -1 : 1;
      var vSign = g.invertV ? -1 : 1;
      g.rotationY += hSign * dx * 0.01;
      g.rotationX += vSign * dy * 0.01;
      g.rotationX = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, g.rotationX));
      lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      if (typeof g.drawScene === 'function') g.drawScene();
    } else if (e.touches.length === 2 && pinchStartDist !== null && pinchStartZoom !== null) {
      e.preventDefault();
      var dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      // Fix: invert direction and reduce sensitivity
      // Pinch in (fingers together, dist decreases) should zoom in (zoom increases)
      // Pinch out (fingers apart, dist increases) should zoom out (zoom decreases)
      // Use a small exponent for less sensitivity
      var scale = pinchStartDist / dist;
      g.zoom = pinchStartZoom * Math.pow(scale, 0.15); // much less sensitive
      if (typeof g.drawScene === 'function') g.drawScene();
    }
  }, { passive: false });

  canvas.addEventListener('touchend', function(e) {
    if (e.touches.length === 0) {
      isRotating = false;
      lastTouch = null;
      pinchStartDist = null;
      pinchStartZoom = null;
      dragTarget = null;
    }
  });

  // --- Only simulate mousedown for vector tip if touch is on tip ---
  document.addEventListener('touchstart', function(e) {
    var target = e.target;
    if (target.classList && target.classList.contains('vector-tip-draggable')) {
      // Simulate mousedown for drag logic in script.js
      var evt = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: e.touches[0].clientX,
        clientY: e.touches[0].clientY
      });
      target.dispatchEvent(evt);
      e.preventDefault();
    }
  }, { passive: false });

  // Prevent scrolling on canvas
  canvas.addEventListener('touchmove', function(e) {
    e.preventDefault();
  }, { passive: false });

  // Optional: auto-hide sidebar on mobile after vector edit
  var vectorSidebar = document.getElementById('vectorSidebar');
  var sidebarOverlay = document.getElementById('sidebarOverlay');
  if (vectorSidebar) {
    vectorSidebar.addEventListener('change', function(e) {
      if (window.innerWidth < 700) {
        setTimeout(function() {
          vectorSidebar.classList.remove('open');
          if (sidebarOverlay) {
            sidebarOverlay.style.display = 'none';
            sidebarOverlay.style.opacity = '0';
            sidebarOverlay.style.pointerEvents = 'none';
          }
          var controlsPanel = document.getElementById('controlsPanel');
          if (controlsPanel) controlsPanel.style.display = '';
        }, 400);
      }
    });
  }
  // Hide controls panel when sidebar is open (on mobile)
  if (vectorSidebar && sidebarOverlay) {
    var observer = new MutationObserver(function() {
      if (window.innerWidth < 700) {
        var controlsPanel = document.getElementById('controlsPanel');
        if (vectorSidebar.classList.contains('open')) {
          if (controlsPanel) controlsPanel.style.display = 'none';
        } else {
          if (controlsPanel) controlsPanel.style.display = '';
        }
      }
    });
    observer.observe(vectorSidebar, { attributes: true, attributeFilter: ['class'] });
  }
})();
