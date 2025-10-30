/*
  © 2025 KondaSoft
  https://www.kondasoft.com
*/

// Format money
window.Shopify.formatMoney = function (
  cents,
  moneyFormat = window.kondasoft.moneyFormat
) {
  if (typeof cents === "string") {
    cents = cents.replace(".", "");
  }

  let value = "";
  const placeholderRegex = /\{\{\s*(\w+)\s*\}\}/;

  function defaultOption(opt, def) {
    return typeof opt === "undefined" ? def : opt;
  }

  function formatWithDelimiters(number, precision, thousands, decimal) {
    precision = defaultOption(precision, 2);
    thousands = defaultOption(thousands, ",");
    decimal = defaultOption(decimal, ".");

    if (isNaN(number) || number == null) {
      return 0;
    }

    number = (number / 100.0).toFixed(precision);

    const parts = number.split(".");
    const dollars = parts[0].replace(
      /(\d)(?=(\d\d\d)+(?!\d))/g,
      "$1" + thousands
    );
    const cents = parts[1] ? decimal + parts[1] : "";

    return dollars + cents;
  }

  switch (moneyFormat.match(placeholderRegex)[1]) {
    case "amount":
      value = formatWithDelimiters(cents, 2);
      break;
    case "amount_no_decimals":
      value = formatWithDelimiters(cents, 0);
      break;
    case "amount_with_comma_separator":
      value = formatWithDelimiters(cents, 2, ".", ",");
      break;
    case "amount_no_decimals_with_comma_separator":
      value = formatWithDelimiters(cents, 0, ".", ",");
      break;
  }

  return moneyFormat.replace(placeholderRegex, value);
};

// Resize images
window.Shopify.resizeImage = function (src, size, crop = "") {
  return src
    .replace(
      /_(pico|icon|thumb|small|compact|medium|large|grande|original|1024x1024|2048x2048|master)+\./g,
      "."
    )
    .replace(/\.jpg|\.png|\.gif|\.jpeg/g, (match) => {
      if (crop.length) {
        crop = `_crop_${crop}`;
      }
      return `_${size}${crop}${match}`;
    });
};

// Calculate "xx time ago"
window.Shopify.calcTimeAgo = function (timestamp) {
  const now = new Date().getTime();
  const diff = now - timestamp;

  let text;

  if (diff < 60000) {
    text = window.kondasoft.times.moments;
  } else if (diff < 3.6e6) {
    const min = Math.round(diff / 60000);
    text =
      min === 1
        ? `${min} ${window.kondasoft.times.minute}`
        : `${min} ${window.kondasoft.times.minutes}`;
  } else if (diff < 8.64e7) {
    const hours = Math.round(diff / 3.6e6);
    text =
      hours === 1
        ? `${hours} ${window.kondasoft.times.hour}`
        : `${hours} ${window.kondasoft.times.hours}`;
  } else {
    const days = Math.round(diff / 8.64e7);
    text =
      days === 1
        ? `${days} ${window.kondasoft.times.day}`
        : `${days} ${window.kondasoft.times.days}`;
  }

  return `${text} ${window.kondasoft.times.ago}`;
};

// Create cookie helper fuction
window.ksCreateCookie = function (name, value, days) {
  let date, expires;
  if (days) {
    date = new Date();
    date.setDate(date.getDate() + days);
    expires = "; expires=" + date.toUTCString();
  } else {
    expires = "";
  }
  document.cookie = name + "=" + value + expires + "; path=/";
};

// Lazy load autoplayed videos
const lazyVideosObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.play();
        entry.target.muted = true;
      }
    });
  },
  { rootMargin: "0px 0px 300px 0px" }
);
document.querySelectorAll('video[data-autoplay="true"]').forEach((el) => {
  lazyVideosObserver.observe(el);
});

// Fix - Megamenu is not closed when clicking within the fancy slideshow
document.querySelectorAll(".ks-fancy-slideshow").forEach((elem) => {
  elem.addEventListener("click", () => {
    document.querySelectorAll(".mega-menu").forEach((elem) => {
      elem.removeAttribute("open");
    });
    document.querySelectorAll(".header__menu-item").forEach((elem) => {
      elem.setAttribute("aria-expanded", "false");
    });
  });
});

// HTML5 accordions add animation support
document.querySelectorAll(".accordion__content").forEach((element) => {
  const detailsElement = element.closest("details");
  const summaryElement = element.previousElementSibling;

  detailsElement.classList.add("accordion__details");

  const wrapper = document.createElement("div");
  element.parentNode.insertBefore(wrapper, element);
  wrapper.appendChild(element);
  wrapper.id = element.id;
  wrapper.classList = element.classList;

  element.removeAttribute("id");
  element.removeAttribute("class");

  if (wrapper.classList.contains("rte")) {
    wrapper.classList.remove("rte");
    element.classList.add("rte");
  }

  summaryElement.addEventListener("click", (event) => {
    if (wrapper.classList.contains("summary-animation")) {
      wrapper.classList.remove("summary-animation", "summary-collapsing");
      void element.offsetWidth;
      return;
    }

    const onAnimationEnd = (cb) =>
      wrapper.addEventListener("animationend", cb, { once: true });

    requestAnimationFrame(() => wrapper.classList.add("summary-animation"));
    onAnimationEnd(() => wrapper.classList.remove("summary-animation"));

    const isDetailsOpen = detailsElement.getAttribute("open") !== null;
    if (isDetailsOpen) {
      event.preventDefault();
      wrapper.classList.add("summary-collapsing");
      onAnimationEnd(() => {
        detailsElement.removeAttribute("open");
        wrapper.classList.remove("summary-collapsing");
      });
    }
  });
});

class KsAnimatedCountdown extends HTMLElement {
  constructor() {
    super();

    if (!this.dataset.time.length) {
      this.innerHTML = "Please add the unix time in the settings";
    }

    let countDownDate = Number(this.dataset.time) * 1000;

    if (window.location.href.includes("dawn-")) {
      countDownDate = Date.now() + 4.32e7;
    }

    const textTimes = window.kondasoft.times;

    let d = textTimes.d;
    let h = textTimes.h;
    let m = textTimes.m;
    let s = textTimes.s;

    if (this.dataset.format === "long") {
      d = textTimes.days;
      h = textTimes.hours;
      m = textTimes.minutes;
      s = textTimes.seconds;
    }

    const x = setInterval(() => {
      const now = new Date().getTime();
      const distance = countDownDate - now;

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const min = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const sec = Math.floor((distance % (1000 * 60)) / 1000);

      if (days > 0) {
        this.querySelector("[data-days]").innerHTML = `${days}<em>${d}</em>`;
      } else {
        this.querySelector("[data-days]")?.parentElement.remove();
      }
      if (hours > 0) {
        this.querySelector("[data-hours]").innerHTML = `${hours}<em>${h}</em>`;
      } else {
        this.querySelector("[data-hours]")?.parentElement.remove();
      }
      this.querySelector("[data-min]").innerHTML = `${min}<em>${m}</em>`;
      this.querySelector("[data-sec]").innerHTML = `${sec}<em>${s}</em>`;

      if (distance < 0) {
        clearInterval(x);
        this.innerHTML = textTimes.expired;
      }

      this.setAttribute("data-init", "true");
    }, 1000);
  }
}
customElements.define("ks-animated-countdown", KsAnimatedCountdown);

class KsWishlistDrawer extends HTMLElement {
  constructor() {
    super();

    this.addEventListener(
      "keyup",
      (evt) => evt.code === "Escape" && this.close()
    );
    this.querySelector(".drawer__overlay").addEventListener(
      "click",
      this.close.bind(this)
    );
    this.setIconsAccessibility();
  }

  setIconsAccessibility() {
    document
      .querySelectorAll('a[href="#ks-wishlist-drawer"]')
      .forEach((link) => {
        link.addEventListener("click", (event) => {
          event.preventDefault();
          this.open(link);
        });
        link.addEventListener("keydown", (event) => {
          if (event.code.toUpperCase() === "SPACE") {
            event.preventDefault();
            this.open(link);
          }
        });
      });
  }

  open(triggeredBy) {
    if (triggeredBy) this.setActiveElement(triggeredBy);

    // here the animation doesn't seem to always get triggered. A timeout seem to help
    setTimeout(() => {
      this.classList.add("animate", "active");
    });

    this.addEventListener(
      "transitionend",
      () => {
        const containerToTrapFocusOn = this.classList.contains("is-empty")
          ? this.querySelector(".drawer__inner-empty")
          : this.querySelector(".ks-wishlist-drawer");
        const focusElement =
          this.querySelector(".drawer__inner") ||
          this.querySelector(".drawer__close");
        window.trapFocus(containerToTrapFocusOn, focusElement);
      },
      { once: true }
    );

    document.body.classList.add("overflow-hidden");
  }

  close() {
    this.classList.remove("active");
    window.removeTrapFocus(this.activeElement);
    document.body.classList.remove("overflow-hidden");
  }

  setActiveElement(element) {
    this.activeElement = element;
  }
}
customElements.define("ks-wishlist-drawer", KsWishlistDrawer);

class KsWishlistContainer extends HTMLElement {
  constructor() {
    super();

    this.setCountBadges();
    this.setContent();
  }

  get wishlist() {
    return JSON.parse(localStorage.getItem("ks-wishlist")) || [];
  }

  set wishlist(array) {
    localStorage.setItem("ks-wishlist", JSON.stringify(array));
  }

  async setProduct(url) {
    let wishlist = this.wishlist;
    const isWishlisted = this.wishlist.some((elem) => elem.url === url);

    if (isWishlisted) {
      wishlist = this.wishlist.filter((elem) => elem.url !== url);
    } else {
      const response = await fetch(`${url}.js`);
      const product = await response.json();
      // console.log(product)

      wishlist.push({
        url,
        id: product.id,
        handle: product.handle,
        title: product.title,
        img_src: product.featured_image,
        img_alt: product.featured_image.alt,
        compare_at_price: product.compare_at_price,
        price: product.price,
        price_varies: product.price_varies,
        added_at: Date.now(),
      });
    }

    this.wishlist = wishlist;
    this.setCountBadges();
    this.setContent();
  }

  setCountBadges() {
    document.querySelectorAll(".wishlist-count-bubble").forEach((elem) => {
      elem.querySelector("span").textContent = this.wishlist.length;
      if (this.wishlist.length) {
        elem.removeAttribute("hidden");
      } else {
        elem.setAttribute("hidden", "hidden");
      }
    });
  }

  setContent() {
    if (this.wishlist.length) {
      this.querySelector(".ks-wishlist-empty").setAttribute("hidden", "hidden");
      this.classList.remove("is-empty");

      let productList = "";
      let imgWidth, imgHeight;

      switch (this.dataset.imgOrientation) {
        case "ratio-4x3":
          imgWidth = 600;
          imgHeight = Math.round((600 / 4) * 3);
          break;
        case "ratio-3x4":
          imgWidth = Math.round((600 / 4) * 3);
          imgHeight = 600;
          break;
        default:
          imgWidth = 600;
          imgHeight = 600;
      }

      this.wishlist.forEach((product) => {
        productList += `
          <div class="ks-wishlist-drawer-product-list-item ks-grid-product-list-item" role="listitem">
            <a href="${product.url}" tabindex="-1">
              <img 
                src="${window.Shopify.resizeImage(
                  product.img_src,
                  `${imgWidth}x${imgHeight}`,
                  "center"
                )}"
                class="product-card-img img-fluid ${this.dataset.imgBorder}" 
                alt="${product.img_alt}" 
                width="${imgWidth}" 
                height="${imgHeight}" 
                loading="lazy">
            </a>
            <div class="">
              <h4 class="title h5 text-truncate">
                <a href="${product.url}" class="full-unstyled-link">
                  ${product.title}
                </a>
              </h4>
              <div class="price">
                <div class="price__container">
                  <span class="price-item price-item--last">
                      ${window.Shopify.formatMoney(product.price)}
                  </span>
                </div>
              </div>
              <div class="ks-grid-product-list-item-added-at">
                <svg xmlns="http://www.w3.org/2000/svg" class="me-2" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                ${window.Shopify.calcTimeAgo(product.added_at)}
              </div>
            </div>
            <button 
              class="ks-wishlist-product-item-btn-remove"
              type="button"
              aria-label="Remove"
              data-product-url="${product.url}">
              <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-remove" viewBox="0 0 16 16" width="16" height="16"> 
                <path fill="currentColor" d="M14 3h-3.53a3.07 3.07 0 0 0-.6-1.65C9.44.82 8.8.5 8 .5s-1.44.32-1.87.85A3.06 3.06 0 0 0 5.53 3H2a.5.5 0 0 0 0 1h1.25v10c0 .28.22.5.5.5h8.5a.5.5 0 0 0 .5-.5V4H14a.5.5 0 0 0 0-1M6.91 1.98c.23-.29.58-.48 1.09-.48s.85.19 1.09.48c.2.24.3.6.36 1.02h-2.9c.05-.42.17-.78.36-1.02m4.84 11.52h-7.5V4h7.5z"></path><path fill="currentColor" d="M6.55 5.25a.5.5 0 0 0-.5.5v6a.5.5 0 0 0 1 0v-6a.5.5 0 0 0-.5-.5m2.9 0a.5.5 0 0 0-.5.5v6a.5.5 0 0 0 1 0v-6a.5.5 0 0 0-.5-.5"></path>
              </svg>
            </button>
          </div>
        `;
      });

      this.querySelector(".ks-wishlist-drawer-product-list").innerHTML =
        productList;
      this.querySelector(
        ".ks-wishlist-drawer-product-list-wrapper"
      ).removeAttribute("hidden");

      document
        .querySelectorAll(".ks-wishlist-product-item-btn-remove")
        .forEach((removeBtn) => {
          removeBtn.addEventListener("click", () => {
            this.setProduct(removeBtn.dataset.productUrl);

            document
              .querySelectorAll(".ks-wishlist-btn")
              .forEach((wishlistButton) => {
                wishlistButton.adjustBtn();
              });
          });
        });
    } else {
      this.querySelector(".ks-wishlist-empty").removeAttribute("hidden");
      this.classList.add("is-empty");
      this.querySelector(".ks-wishlist-drawer-product-list").innerHTML = "";
      this.querySelector(
        ".ks-wishlist-drawer-product-list-wrapper"
      ).setAttribute("hidden", "hidden");
    }
  }
}

customElements.define("ks-wishlist-container", KsWishlistContainer);

class KsWishlistBtn extends HTMLElement {
  constructor() {
    super();

    this.btn = this.querySelector("button");
    this.wishlistContainer = document.querySelector("ks-wishlist-container");

    this.adjustBtn();

    this.btn.addEventListener("click", async (event) => {
      event.preventDefault();

      await this.wishlistContainer.setProduct(this.dataset.productUrl);
      this.adjustBtn();
    });
  }

  adjustBtn() {
    const isWishlisted = this.wishlistContainer.wishlist.some(
      (elem) => elem.url === this.dataset.productUrl
    );

    if (isWishlisted) {
      this.btn.classList.add("active");
      this.btn.setAttribute("aria-label", window.kondasoft.wishlist.remove);
      this.btn.setAttribute("aria-pressed", "true");
    } else {
      this.btn.classList.remove("active");
      this.btn.setAttribute("aria-label", window.kondasoft.wishlist.add);
      this.btn.setAttribute("aria-pressed", "false");
    }
  }
}
customElements.define("ks-wishlist-btn", KsWishlistBtn);

class KsRecentlyViewedDrawer extends HTMLElement {
  constructor() {
    super();

    this.addEventListener(
      "keyup",
      (evt) => evt.code === "Escape" && this.close()
    );
    this.querySelector(".drawer__overlay").addEventListener(
      "click",
      this.close.bind(this)
    );
    this.setIconsAccessibility();
  }

  setIconsAccessibility() {
    document
      .querySelectorAll('a[href="#ks-recently-viewed-drawer"]')
      .forEach((link) => {
        link.addEventListener("click", (event) => {
          event.preventDefault();
          this.open(link);
        });
        link.addEventListener("keydown", (event) => {
          if (event.code.toUpperCase() === "SPACE") {
            event.preventDefault();
            this.open(link);
          }
        });
      });
  }

  open(triggeredBy) {
    if (triggeredBy) this.setActiveElement(triggeredBy);

    // here the animation doesn't seem to always get triggered. A timeout seem to help
    setTimeout(() => {
      this.classList.add("animate", "active");
    });

    this.addEventListener(
      "transitionend",
      () => {
        const containerToTrapFocusOn = this.classList.contains("is-empty")
          ? this.querySelector(".drawer__inner-empty")
          : this.querySelector(".ks-recently-viewed-drawer");
        const focusElement =
          this.querySelector(".drawer__inner") ||
          this.querySelector(".drawer__close");
        window.trapFocus(containerToTrapFocusOn, focusElement);
      },
      { once: true }
    );

    document.body.classList.add("overflow-hidden");
  }

  close() {
    this.classList.remove("active");
    window.removeTrapFocus(this.activeElement);
    document.body.classList.remove("overflow-hidden");
  }

  setActiveElement(element) {
    this.activeElement = element;
  }
}
customElements.define("ks-recently-viewed-drawer", KsRecentlyViewedDrawer);

class KsRecentlyViewedContainer extends HTMLElement {
  constructor() {
    super();

    this.initTriggers();
    this.setContent();
    this.handleRemoveAll();
  }

  get recentlyViewed() {
    return JSON.parse(localStorage.getItem("ks-recently-viewed")) || [];
  }

  set recentlyViewed(array) {
    localStorage.setItem("ks-recently-viewed", JSON.stringify(array));
  }

  initTriggers() {
    document.querySelectorAll("[data-recently-viewed-set]").forEach((elem) => {
      this.setProduct(elem.dataset.productUrl);
    });
  }

  async setProduct(url) {
    let recentlyViewed = this.recentlyViewed;
    const isViewed = this.recentlyViewed.some((elem) => elem.url === url);

    if (isViewed) {
      recentlyViewed = this.recentlyViewed.filter((elem) => elem.url !== url);
    }

    const response = await fetch(`${url}.js`);
    const product = await response.json();
    // console.log(product)

    recentlyViewed.push({
      url,
      id: product.id,
      handle: product.handle,
      title: product.title,
      img_src: product.featured_image,
      img_alt: product.featured_image.alt,
      compare_at_price: product.compare_at_price,
      price: product.price,
      price_varies: product.price_varies,
      added_at: Date.now(),
    });

    function keepLastXItemsInArray(arr, x) {
      if (x >= 0 && x <= arr.length) {
        return arr.slice(-x);
      } else {
        return arr;
      }
    }

    recentlyViewed = keepLastXItemsInArray(
      recentlyViewed,
      Number(this.dataset.limit)
    );

    this.recentlyViewed = recentlyViewed;
    this.setContent();
  }

  setContent() {
    if (this.recentlyViewed.length) {
      this.querySelector(".ks-recently-viewed-empty").setAttribute(
        "hidden",
        "hidden"
      );
      this.classList.remove("is-empty");

      let productList = "";
      let imgWidth, imgHeight;

      switch (this.dataset.imgOrientation) {
        case "ratio-4x3":
          imgWidth = 600;
          imgHeight = Math.round((600 / 4) * 3);
          break;
        case "ratio-3x4":
          imgWidth = Math.round((600 / 4) * 3);
          imgHeight = 600;
          break;
        default:
          imgWidth = 600;
          imgHeight = 600;
      }

      this.recentlyViewed.forEach((product) => {
        productList += `
          <div class="ks-recently-viewed-drawer-product-list-item ks-grid-product-list-item" role="listitem">
            <a href="${product.url}" tabindex="-1">
              <img 
                src="${window.Shopify.resizeImage(
                  product.img_src,
                  `${imgWidth}x${imgHeight}`,
                  "center"
                )}"
                class="img-fluid ${this.dataset.imgBorder}" 
                alt="${product.img_alt}" 
                width="${imgWidth}" 
                height="${imgHeight}" 
                loading="lazy">
            </a>
            <div class="">
              <h4 class="title h5 text-truncate">
                <a href="${product.url}" class="full-unstyled-link">
                  ${product.title}
                </a>
              </h4>
              <div class="price">
                <div class="price__container">
                  <span class="price-item price-item--last">
                      ${window.Shopify.formatMoney(product.price)}
                  </span>
                </div>
              </div>
              <div class="ks-grid-product-list-item-added-at">
                <svg xmlns="http://www.w3.org/2000/svg" class="me-2" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                ${window.Shopify.calcTimeAgo(product.added_at)}
              </div>
            </div>
            <button 
              class="ks-recently-viewed-product-item-btn-remove"
              type="button"
              aria-label="Remove"
              data-product-url="${product.url}">
              <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-remove" viewBox="0 0 16 16" width="16" height="16"> 
                <path fill="currentColor" d="M14 3h-3.53a3.07 3.07 0 0 0-.6-1.65C9.44.82 8.8.5 8 .5s-1.44.32-1.87.85A3.06 3.06 0 0 0 5.53 3H2a.5.5 0 0 0 0 1h1.25v10c0 .28.22.5.5.5h8.5a.5.5 0 0 0 .5-.5V4H14a.5.5 0 0 0 0-1M6.91 1.98c.23-.29.58-.48 1.09-.48s.85.19 1.09.48c.2.24.3.6.36 1.02h-2.9c.05-.42.17-.78.36-1.02m4.84 11.52h-7.5V4h7.5z"></path><path fill="currentColor" d="M6.55 5.25a.5.5 0 0 0-.5.5v6a.5.5 0 0 0 1 0v-6a.5.5 0 0 0-.5-.5m2.9 0a.5.5 0 0 0-.5.5v6a.5.5 0 0 0 1 0v-6a.5.5 0 0 0-.5-.5"></path>
              </svg>
            </button>
          </div>
        `;
      });

      this.querySelector(".ks-recently-viewed-drawer-product-list").innerHTML =
        productList;
      this.querySelector(
        ".ks-recently-viewed-drawer-product-list-wrapper"
      ).removeAttribute("hidden");

      this.querySelectorAll(
        ".ks-recently-viewed-product-item-btn-remove"
      ).forEach((removeBtn) => {
        removeBtn.addEventListener("click", () => {
          let recentlyViewed = this.recentlyViewed.filter(
            (elem) => elem.url !== removeBtn.dataset.productUrl
          );
          this.recentlyViewed = recentlyViewed;
          this.setContent();
        });
      });
    } else {
      this.querySelector(".ks-recently-viewed-empty").removeAttribute("hidden");
      this.classList.add("is-empty");
      this.querySelector(".ks-recently-viewed-drawer-product-list").innerHTML =
        "";
      this.querySelector(
        ".ks-recently-viewed-drawer-product-list-wrapper"
      ).setAttribute("hidden", "hidden");
    }
  }

  handleRemoveAll() {
    document
      .querySelectorAll(".ks-recently-viewed-btm-remove-all")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          this.recentlyViewed = [];
          this.setContent();
        });
      });
  }
}

customElements.define(
  "ks-recently-viewed-container",
  KsRecentlyViewedContainer
);

// class CollectionPagination extends HTMLElement {
//   constructor () {
//     super()

//     this.querySelectorAll('a').forEach(elem => {
//       elem.addEventListener('click', (event) => {
//         event.preventDefault()

//         const params = new URLSearchParams(window.location.search)
//         const newPage = elem.getAttribute('href').split('page=')[1]
//         params.set('page', newPage)
//         const url = `${window.location.pathname}?${params.toString()}`
//         window.history.replaceState({}, '', url)
//       })
//     })
//   }

// }
// customElements.define('collection-pagination', CollectionPagination)
