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
  var script = window; // script.js globals live here

  function getScriptGlobals() {
    // Find the script.js context (globals)
    return window;
  }
  var g = getScriptGlobals();

  canvas.addEventListener('touchstart', function(e) {
    if (e.touches.length === 1) {
      isRotating = true;
      lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', function(e) {
    if (isRotating && e.touches.length === 1) {
      e.preventDefault();
      var dx = e.touches[0].clientX - lastTouch.x;
      var dy = e.touches[0].clientY - lastTouch.y;
      // Use same logic as middle mouse: both axes
      var hSign = g.invertH ? -1 : 1;
      var vSign = g.invertV ? -1 : 1;
      g.rotationY += hSign * dx * 0.01;
      g.rotationX += vSign * dy * 0.01;
      g.rotationX = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, g.rotationX));
      lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      if (typeof g.drawScene === 'function') g.drawScene();
    }
  }, { passive: false });

  canvas.addEventListener('touchend', function(e) {
    isRotating = false;
    lastTouch = null;
  });

  // Make vector tips easier to drag on mobile (increase hit area)
  // Already handled by CSS, but ensure touch events work
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
