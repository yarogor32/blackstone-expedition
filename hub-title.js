(() => {
  // The location plate belongs above modal windows as well as the hub scene.
  let currentPlate = null;
  new MutationObserver(records => {
    const plate = document.querySelector('.hub-layout > .hub-title-plaque');
    if (!plate || typeof plate.showPopover !== 'function') {
      currentPlate = plate;
      return;
    }
    // Keep the plate in the scene so it is revealed by the same loading fade.
    if (document.querySelector('.hub-loading')) {
      if (plate.matches(':popover-open')) plate.hidePopover();
      plate.removeAttribute('popover');
      currentPlate = null;
      return;
    }
    const modalOpened = records.some(record =>
      record.type === 'attributes' && record.target.matches('dialog[open]') ||
      record.type === 'childList' && [...record.addedNodes].some(node =>
        node.nodeType === 1 && (node.matches('dialog[open]') || node.querySelector('dialog[open]'))));
    if (plate !== currentPlate || modalOpened || !plate.matches(':popover-open')) {
      plate.setAttribute('popover', 'manual');
      if (plate.matches(':popover-open')) plate.hidePopover();
      plate.showPopover();
      currentPlate = plate;
    }
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
})();
