import { hasCSSOverflow, hasOverflow, nextTick } from "./support/utils.js";

export type Options = {
  /** Mirror the vertical scroll position */
  vertical: boolean;
  /** Mirror the horizontal scroll position */
  horizontal: boolean;
};

type Progress = {
  x: number;
  y: number;
};

/**
 * Mirrors the scroll position of multiple elements on a page
 */
export default class ScrollMirror {
  /** Mirror the scroll positions of these elements */
  readonly elements: HTMLElement[];
  /** The default options */
  readonly defaults: Options = {
    vertical: true,
    horizontal: true,
  };
  /** The parsed options */
  options: Options;
  /** Is mirroring paused? */
  paused: boolean = false;
  /** @internal */
  prefix: string = "[scroll-mirror]";

  constructor(
    elements: NodeListOf<Element> | Element[],
    options: Partial<Options> = {}
  ) {
    this.elements = [...elements]
      .filter(Boolean)
      .map((el) => this.getScrollContainer(el));

    // remove duplicates
    this.elements = [...new Set(this.elements)];

    this.options = { ...this.defaults, ...options };

    if (!this.validateElements()) return;

    this.elements.forEach((element) => this.addHandler(element));
    /**
     * Initially, make sure that elements are mirrored to the
     * documentElement's scroll position (if provided)
     */
    if (this.elements.includes(document.documentElement)) {
      this.mirrorScrollPositions(
        this.getScrollProgress(document.documentElement),
        document.documentElement
      );
    }
  }

  /** Pause mirroring */
  pause() {
    this.paused = true;
  }

  /** Resume mirroring */
  resume() {
    this.paused = false;
  }

  /** Destroy. Removes all event handlers */
  destroy() {
    this.elements.forEach((element) => this.removeHandler(element));
  }

  /** Make sure the provided elements are valid @internal */
  validateElements(): boolean {
    const elements = [...this.elements];
    if (elements.length < 2) {
      console.error(`${this.prefix} Please provide at least two elements`);
      return false;
    }
    for (const element of elements) {
      if (!element) {
        console.warn(`${this.prefix} element is not defined:`, element);
        return false;
      }
      if (element instanceof HTMLElement && !hasOverflow(element)) {
        console.warn(`${this.prefix} element doesn't have overflow:`, element);
      }
      if (
        element instanceof HTMLElement &&
        element.matches("body *") &&
        !hasCSSOverflow(element)
      ) {
        console.warn(
          `${this.prefix} no "overflow: auto;" or "overflow: scroll;" set on element:`,
          element
        );
      }
    }
    return true;
  }

  /** Add the scroll handler to the element @internal */
  addHandler(element: HTMLElement) {
    /** Safeguard to prevent duplicate handlers on elements */
    this.removeHandler(element);

    const target = this.getEventTarget(element);
    target.addEventListener("scroll", this.handleScroll);
  }

  /** Remove the scroll handler from an element @internal */
  removeHandler(element: HTMLElement) {
    const target = this.getEventTarget(element);
    target.removeEventListener("scroll", this.handleScroll);
  }

  /**
   * Get the scroll container, based on element provided:
   * - return the element if it's a child of <body>
   * - otherwise, return the documentElement
   */
  getScrollContainer(el: unknown): HTMLElement {
    if (el instanceof HTMLElement && el.matches("body *")) return el;
    return document.documentElement;
  }

  /**
   * Get the event target for receiving scroll events
   * - return the window if the element is either the html or body element
   * - otherwise, return the element
   */
  getEventTarget(element: HTMLElement): Window | HTMLElement {
    return element.matches("body *") ? element : window;
  }

  /** Handle a scroll event on an element @internal */
  handleScroll = async (event: Event) => {
    if (this.paused) return;

    if (!event.currentTarget) return;

    const scrolledElement = this.getScrollContainer(event.currentTarget);

    await nextTick();

    this.mirrorScrollPositions(
      this.getScrollProgress(scrolledElement),
      scrolledElement
    );
  };

  /** Mirror the scroll positions of all elements to a target @internal */
  mirrorScrollPositions(
    progress: Progress,
    ignore: HTMLElement | undefined = undefined
  ) {
    this.elements.forEach((element) => {
      /* Ignore the currently scrolled element  */
      if (ignore === element) return;

      /* Remove the scroll event listener */
      this.removeHandler(element);

      this.setScrollPosition(progress, element);

      /* Re-attach the scroll event listener */
      window.requestAnimationFrame(() => {
        this.addHandler(element);
      });
    });
  }

  /** Mirror the scroll position from one element to another @internal */
  setScrollPosition(progress: Progress, target: HTMLElement) {
    const { vertical, horizontal } = this.options;

    /* Calculate the actual element scroll lengths */
    const availableScroll = {
      x: target.scrollWidth - target.clientWidth,
      y: target.scrollHeight - target.clientHeight,
    };

    /* Adjust the scroll position accordingly */
    if (vertical && !!availableScroll.y) {
      target.scrollTo({
        top: availableScroll.y * progress.y,
        behavior: "instant",
      });
    }
    if (horizontal && !!availableScroll.x) {
      target.scrollTo({
        left: availableScroll.x * progress.x,
        behavior: "instant",
      });
    }
  }

  /** Get the scroll progress of an element, between 0-1 */
  getScrollProgress(el: HTMLElement): Progress {
    const {
      scrollTop,
      scrollHeight,
      clientHeight,
      scrollLeft,
      scrollWidth,
      clientWidth,
    } = el;

    const availableWidth = scrollWidth - clientWidth;
    const availableHeight = scrollHeight - clientHeight;

    return {
      x: !!scrollLeft ? scrollLeft / Math.max(0.00001, availableWidth) : 0,
      y: !!scrollTop ? scrollTop / Math.max(0.00001, availableHeight) : 0,
    };
  }

  get progress(): Progress {
    return this.getScrollProgress(this.elements[0]);
  }

  /**
   * Get or set the scroll progress of all mirrored elements
   *
   * The progress is an object of { x:number , y: number }, where both x and y are a number
   * between 0-1
   *
   * Examples:
   *  - `const progress = mirror.progress` — returns something like { x: 0.2, y:0.5 }
   *  - `mirror.progress = 0.5` — set the scroll position to 50% on both axes
   *  - `mirror.progress = { y: 0.5 }` — set the scroll position to 50% on the y axis
   *  - `mirror.progress = { x: 0.2, y: 0.5 }` — set the scroll position on both axes
   */
  set progress(value: Partial<Progress> | number) {
    /** if the value is a number, set both axes to that value */
    if (typeof value === "number") {
      value = { x: value, y: value };
    }
    const progress = { ...this.progress, ...value };

    if (!this.validateProgress(progress)) {
      return;
    }

    this.mirrorScrollPositions(progress);
  }

  /** Validate the progress, log errors for invalid values */
  validateProgress(progress: Partial<Progress>) {
    let valid = true;
    for (const [key, value] of Object.entries(progress)) {
      if (typeof value !== "number" || value < 0 || value > 1) {
        console.error(`progress.${key} must be a number between 0-1`);
        valid = false;
      }
    }
    return valid;
  }
}
