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

  // --- Ensure global rotationX and rotationY exist and are numbers ---
  if (typeof window.rotationX !== 'number' || isNaN(window.rotationX)) window.rotationX = 0;
  if (typeof window.rotationY !== 'number' || isNaN(window.rotationY)) window.rotationY = 0;

  // --- Add: getInvertZoom helper ---
  function getInvertZoom() {
    // Use global invertZoom if available, else false
    return typeof g.invertZoom !== 'undefined' ? g.invertZoom : false;
  }

  // --- Fix: Always allow drag to orbit, even if vector tip is present ---
  let dragTarget = null;
  let cameraDragActive = false;
  canvas.addEventListener('touchstart', function(e) {
    if (e.touches.length === 1) {
      let touch = e.touches[0];
      let el = document.elementFromPoint(touch.clientX, touch.clientY);
      if (el && el.classList && el.classList.contains('vector-tip-draggable')) {
        dragTarget = el;
        cameraDragActive = false;
        return;
      }
      cameraDragActive = true;
      lastTouch = { x: touch.clientX, y: touch.clientY };
      dragTarget = null;
      // Debug
      console.log('[mobile.js] Orbit drag start at', lastTouch);
    } else if (e.touches.length === 2) {
      cameraDragActive = false;
      pinchStartDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchStartZoom = window.zoom;
      dragTarget = null;
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', function(e) {
    if (dragTarget) return;
    if (cameraDragActive && e.touches.length === 1) {
      e.preventDefault();
      var dx = e.touches[0].clientX - lastTouch.x;
      var dy = e.touches[0].clientY - lastTouch.y;
      var hSign = window.invertH ? -1 : 1;
      var vSign = window.invertV ? -1 : 1;
      window.rotationY += hSign * dx * 0.01;
      window.rotationX += vSign * dy * 0.01;
      window.rotationX = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, window.rotationX));
      lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      // Debug
      console.log('[mobile.js] Orbit drag move dx:', dx, 'dy:', dy, 'rotationY:', window.rotationY, 'rotationX:', window.rotationX);
      if (typeof window.drawScene === 'function') window.drawScene();
    } else if (e.touches.length === 2 && pinchStartDist !== null && pinchStartZoom !== null) {
      e.preventDefault();
      var dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      var scale = pinchStartDist / dist;
      if (getInvertZoom()) scale = 1 / scale;
      window.zoom = pinchStartZoom * Math.pow(scale, 0.15);
      if (typeof window.drawScene === 'function') window.drawScene();
    }
  }, { passive: false });

  canvas.addEventListener('touchend', function(e) {
    if (e.touches.length === 0) {
      cameraDragActive = false;
      lastTouch = null;
      pinchStartDist = null;
      pinchStartZoom = null;
      dragTarget = null;
      if (window.debugMode) {
        console.log('[mobile.js] Orbit drag end');
      }
    }
  });

  // --- Only simulate mousedown for vector tip if touch is on tip ---
  // Improved: implement real drag for vector tips on mobile
  let vectorTipDragging = null;
  let vectorTipDragOrig = null;
  let vectorTipDragOrigTouch = null;
  let vectorTipDragOffset = null; // <--- add this

  document.addEventListener('touchstart', function(e) {
    var target = e.target;
    // Only start a new drag if not already dragging
    if (!vectorTipDragging && target.classList && target.classList.contains('vector-tip-draggable')) {
      vectorTipDragging = target;
      vectorTipDragOrig = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      // Compute offset between touch and tip center
      const rect = target.getBoundingClientRect();
      vectorTipDragOffset = {
        x: e.touches[0].clientX - (rect.left + rect.width / 2),
        y: e.touches[0].clientY - (rect.top + rect.height / 2)
      };
      // Simulate mousedown for script.js drag logic
      var evt = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: e.touches[0].clientX - vectorTipDragOffset.x,
        clientY: e.touches[0].clientY - vectorTipDragOffset.y
      });
      target.dispatchEvent(evt);
      e.preventDefault();
    }
  }, { passive: false });

  document.addEventListener('touchmove', function(e) {
    if (vectorTipDragging && e.touches.length === 1) {
      // Use the offset so the tip stays under the finger
      var evt = new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        clientX: e.touches[0].clientX - (vectorTipDragOffset ? vectorTipDragOffset.x : 0),
        clientY: e.touches[0].clientY - (vectorTipDragOffset ? vectorTipDragOffset.y : 0)
      });
      vectorTipDragging.dispatchEvent(evt);
      e.preventDefault();
    }
  }, { passive: false });

  document.addEventListener('touchend', function(e) {
    if (vectorTipDragging && e.touches.length === 0) {
      var evt = new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true
      });
      window.dispatchEvent(evt);
      vectorTipDragging = null;
      vectorTipDragOrig = null;
      vectorTipDragOrigTouch = null;
      vectorTipDragOffset = null; // <--- clear offset
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
