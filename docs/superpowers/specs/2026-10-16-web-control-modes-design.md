# Web control modes

Approved in conversation: add one cycling OSOBNO → OSIE → AUTO button to the Bluefy web client, initially OSOBNO. Keep four wheel cards and their existing hold-to-operate buttons. OSIE operates both wheels of the selected axle; AUTO operates all wheels in the chosen direction. Highlight individual cards, axle rows or the entire grid according to mode.

Use the existing valve-mask protocol. Serialize valve writes and cancel stale queued starts when releasing, changing mode, hiding the page or disconnecting. Allow one active pointer; changing mode clears that hold before another operation can begin. Release/cancel/lost capture sends mask zero. Disconnect invalidates queued work. Mode selection is local to the page and resets to OSOBNO on reload.

Verify all wheel/direction/mode combinations, delayed writes, mode changes, canceled holds and disconnects with Node tests. Publish this feature to calka00/Air-web on main; existing GitHub Pages workflow tests and deploys web/ to https://calka00.github.io/Air-web/. Verify workflow and public assets. Physical Bluefy/BLE behavior requires an iPhone and manifold.
