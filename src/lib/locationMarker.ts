// Lazy-initialized LocationMarker OverlayView (requires Maps API to be loaded before instantiation)

type LocationMarkerInstance = google.maps.OverlayView & {
  update(pos: google.maps.LatLng, heading: number | null): void;
};

let _ctor: (new (pos: google.maps.LatLng, heading: number | null) => LocationMarkerInstance) | null = null;

export function getLocationMarkerClass(): new (pos: google.maps.LatLng, heading: number | null) => LocationMarkerInstance {
  if (_ctor) return _ctor;

  class LocationMarker extends google.maps.OverlayView {
    private _pos: google.maps.LatLng;
    private _heading: number | null;
    private _div: HTMLDivElement | null = null;

    constructor(pos: google.maps.LatLng, heading: number | null) {
      super();
      this._pos = pos;
      this._heading = heading;
    }

    onAdd() {
      this._div = document.createElement('div');
      this._div.style.position = 'absolute';
      this._div.style.pointerEvents = 'none';
      this._updateHtml();
      this.getPanes()!.overlayMouseTarget.appendChild(this._div);
    }

    _updateHtml() {
      if (!this._div) return;
      const rot = this._heading ?? 0;
      const hasHeading = this._heading != null;
      this._div.innerHTML = `<div style="transform:rotate(${rot}deg);display:flex;flex-direction:column;align-items:center;gap:2px;">${hasHeading ? '<div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:10px solid #4A90D9;"></div>' : ''}<div style="width:20px;height:20px;border-radius:50%;background:#4A90D9;border:2.5px solid white;display:flex;align-items:center;justify-content:center;"><div style="width:6px;height:6px;border-radius:50%;background:white;"></div></div></div>`;
    }

    draw() {
      if (!this._div) return;
      const proj = this.getProjection();
      const point = proj.fromLatLngToDivPixel(this._pos);
      if (point) {
        const hasHeading = this._heading != null;
        this._div.style.left = `${point.x - 10}px`;
        this._div.style.top = hasHeading
          ? `${point.y - 22}px`
          : `${point.y - 10}px`;
      }
    }

    update(pos: google.maps.LatLng, heading: number | null) {
      this._pos = pos;
      this._heading = heading;
      this._updateHtml();
      this.draw();
    }

    onRemove() {
      if (this._div) {
        this._div.parentNode?.removeChild(this._div);
        this._div = null;
      }
    }
  }

  _ctor = LocationMarker;
  return _ctor;
}
