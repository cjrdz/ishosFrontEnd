/** Store branches: one list for the home page and the About page. */
export interface Branch {
  name: string;
  area: string;
  /** Opens Google Maps (directions) in a new tab. */
  maps: string;
  /** Google Maps embed for the About page. */
  embed: string;
}

export const BRANCHES: Branch[] = [
  {
    name: "Isho's Sucursal 1",
    area: "Ahuachapán, El Salvador",
    maps: "https://maps.google.com/?q=Isho%27s+Sucursal+1,+Ahuachap%C3%A1n,+El+Salvador",
    embed:
      "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d6847.623198808501!2d-89.8518696249066!3d13.92355228648646!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8f6297001f790639%3A0xa292396c664dfae0!2sIsho%E2%80%99s%20Sucursal%201!5e1!3m2!1ses!2ssv!4v1777132497595!5m2!1ses!2ssv",
  },
  {
    name: "Isho's Sucursal 2",
    area: "Ahuachapán, El Salvador",
    maps: "https://maps.app.goo.gl/bSYLeqagKbSW3wUh8",
    embed:
      "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d6847.705736039818!2d-89.8483311!3d13.920766299999997!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8f6297004861f67d%3A0xfed9bfb450de212f!2sIsho%E2%80%99s%20sucursal%202!5e1!3m2!1ses!2ssv!4v1777132555390!5m2!1ses!2ssv",
  },
];
