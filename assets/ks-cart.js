/*
  © 2025 KondaSoft
  https://www.kondasoft.com
*/

/*
  Cart collapses - scroll to element
*/
window.ksCartDrawerFixScrollPosition = () => {
  setTimeout(() => {
    const wrapper = document.querySelector(".ks-cart-drawer-wrapper");
    wrapper.scroll({ top: wrapper.scrollHeight, behavior: "smooth" });
  }, 250);
};

/*
  Cart goal
*/
class KsCartGoal extends HTMLElement {
  constructor() {
    super();

    this.progressBar = this.querySelector(".bs-progress-bar");
    this.animateProgressBar();
    this.initConfetti();
  }

  animateProgressBar() {
    setTimeout(() => {
      this.progressBar.style.width = this.progressBar.dataset.width;
    }, 250);
  }

  async initConfetti() {
    if (this.dataset.showConfetti === "false") return;

    const goalCompleted = Number(this.dataset.goalCompleted);
    const prevGoalCompleted = Number(
      localStorage.getItem("ks-cart-goal-completed") || 0
    );

    if (prevGoalCompleted !== goalCompleted) {
      localStorage.setItem("ks-cart-goal-completed", goalCompleted);
    }

    if (goalCompleted <= prevGoalCompleted) return;

    const myCanvas = document.createElement("canvas");
    myCanvas.setAttribute("id", "ks-cart-goal-confetti-canvas");

    if (this.closest(".cart-drawer")) {
      this.closest(".cart-drawer")
        .querySelector(".drawer__inner")
        .insertAdjacentElement("afterbegin", myCanvas);
    }

    const myConfetti = window.confetti.create(myCanvas);

    myConfetti({
      particleCount: 400,
      spread: 90,
    });

    setTimeout(() => {
      myCanvas.remove();
    }, 4000);
  }
}
customElements.define("ks-cart-goal", KsCartGoal);

/*
  Cart upsells
*/
class KsCartUpsells extends HTMLElement {
  constructor() {
    super();

    this.querySelectorAll('select[name="id"]').forEach((select) => {
      select.addEventListener("change", (event) => {
        event.preventDefault();
        const imgSrc = select.options[select.selectedIndex].dataset.variantImg;

        if (imgSrc) {
          const img = select
            .closest(".ks-cart-upsell-item")
            .querySelector(".ks-cart-upsell-item-image img");
          img.src = imgSrc;
        }
      });
    });
  }
}
customElements.define("ks-cart-upsells", KsCartUpsells);

/*
  Shipping calculator
*/
class KsCartShippingCalculator extends HTMLElement {
  constructor() {
    super();

    this.country = this.querySelector("#ks-shipping-calculator-country");
    this.province = this.querySelector("#ks-shipping-calculator-province");
    this.zip = this.querySelector("#ks-shipping-calculator-zip");
    this.alert = this.querySelector("#ks-shipping-calculator-alert");
    this.btn = this.querySelector("button");

    this.initCommonJsScript();
    this.btn.addEventListener("click", this.onSubmit.bind(this));
  }

  async initCommonJsScript() {
    const script = document.createElement("script");
    script.src = this.dataset.shopifyCommonJs;
    document.head.appendChild(script);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    new window.Shopify.CountryProvinceSelector(
      "ks-shipping-calculator-country",
      "ks-shipping-calculator-province",
      {
        hideElement: "ks-shipping-calculator-province-wrapper",
      }
    );

    this.country.options[0].textContent =
      this.country.getAttribute("aria-label");

    this.insertCustomerData();
  }

  insertCustomerData() {
    const country = this.dataset.customerCountry;
    const province = this.dataset.customerProvince;
    const zip = this.dataset.customerZip;

    if (country.length) {
      this.querySelector("#ks-shipping-calculator-country").value = country;
      this.querySelector("#ks-shipping-calculator-country").dispatchEvent(
        new CustomEvent("change")
      );
      if (province.length) {
        this.querySelector("#ks-shipping-calculator-province").value = province;
      }
      if (zip.length) {
        this.querySelector("#ks-shipping-calculator-zip").value = zip;
      }
    }
  }

  async onSubmit() {
    this.btn.classList.add("loading");
    this.btn.querySelector(".loading__spinner").classList.remove("hidden");

    const prepareResponse = await fetch(
      `/cart/prepare_shipping_rates.json?shipping_address[zip]=${this.zip.value}&shipping_address[country]=${this.country.value}&shipping_address[province]=${this.province.value}`,
      {
        method: "POST",
      }
    );


    if (prepareResponse.ok) {
      const asyncResponse = await fetch(
        `/cart/async_shipping_rates.json?shipping_address[zip]=${this.zip.value}&shipping_address[country]=${this.country.value}&shipping_address[province]=${this.province.value}`
      );


      const data = await asyncResponse.json();

      let list = "";

      if (data.shipping_rates.length) {
        data.shipping_rates.forEach((elem) => {
          list += `
            <li>
              <strong>${elem.presentment_name}</strong>: ${elem.price} ${elem.currency}
            </li>
          `;
        });

        this.alert.innerHTML = `
          <ul class="">
            ${list}
          </ul>
        `;
        this.alert.classList.remove("ks-alert-danger", "ks-alert-warning");
        this.alert.classList.add("ks-alert-success");
        this.alert.removeAttribute("hidden");
      } else {
        this.alert.innerHTML = `
          <p class="">
            ${this.dataset.textNoResultsFound}
          </p>
        `;
        this.alert.classList.remove("ks-alert-danger", "ks-alert-success");
        this.alert.classList.add("ks-alert-warning");
        this.alert.removeAttribute("hidden");
      }
    } else {
      const data = await prepareResponse.json();

      let list = "";

      for (const [key, value] of Object.entries(data)) {
        list += `
          <li>
            <b>${key}</b>: ${value.toString()}
          </li>
        `;
      }

      this.alert.innerHTML = `
        <ul class="">
          ${list} 
        </ul>
      `;
      this.alert.classList.remove("ks-alert-success", "ks-alert-warning");
      this.alert.classList.add("ks-alert-danger");
      this.alert.removeAttribute("hidden");
    }

    this.btn.classList.remove("loading");
    this.btn.querySelector(".loading__spinner").classList.add("hidden");
  }
}
customElements.define("ks-cart-shipping-calculator", KsCartShippingCalculator);

/*
  Cart discount form
*/
class KsCartDiscountForm extends HTMLElement {
  constructor() {
    super();

    this.input = this.querySelector("input");
    this.btn = this.querySelector("button");
    this.btn.addEventListener("click", this.onSubmit.bind(this));
  }

  async onSubmit() {
    this.btn.classList.add("loading");
    this.btn.querySelector(".loading__spinner").classList.remove("hidden");

    await fetch(
      `${window.Shopify.routes.root_url}discount/${this.input.value}`
    );
    window.location.href = "/checkout";

    setTimeout(() => {
      this.btn.classList.remove("loading");
      this.btn.querySelector(".loading__spinner").classList.add("hidden");
    }, 2000);
  }
}
customElements.define("ks-cart-discount-form", KsCartDiscountForm);

/*
  Upgrade to subscription
*/
class KsCartSubUpgradeSelector extends HTMLElement {
  constructor() {
    super();

    this.select = this.querySelector("select");
    this.select.addEventListener("change", this.onChange.bind(this));
  }

  async onChange(event) {
    event.preventDefault();
    const cartItems =
      this.closest("cart-items") || this.closest("cart-drawer-items");
    await cartItems.updateQuantity(this.dataset.index, 0, event);

    await new Promise((resolve) => setTimeout(resolve, 500));

    const cart =
      document.querySelector("cart-notification") ||
      document.querySelector("cart-drawer");
    let sections = cart.getSectionsToRender().map((section) => section.id);

    const response = await fetch(`${window.Shopify.routes.root}cart/add.js`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            id: Number(this.dataset.variantId),
            quantity: Number(this.dataset.quantity),
            selling_plan: Number(this.select.value),
          },
        ],
        sections,
      }),
    });
    const responseData = await response.json();
    cart.renderContents(responseData);

    if (cart && cart.classList.contains("is-empty"))
      cart.classList.remove("is-empty");
  }
}
customElements.define("ks-cart-sub-upgrade-selector", KsCartSubUpgradeSelector);

/*
  Delivery calendar
*/
class KsCartDeliveryCalendar extends HTMLElement {
  constructor() {
    super();

    this.injectVendorFiles();
    this.init();

    const script = document.querySelector('script[src*="vanilla-calendar"]');
    script.onload = () => {
      this.init();
    };
  }

  async injectVendorFiles() {
    const style = document.createElement("link");
    style.setAttribute("rel", "stylesheet");
    style.setAttribute("href", this.dataset.vendorCssFile);
    document.head.appendChild(style);

    const script = document.createElement("script");
    script.setAttribute("src", this.dataset.vendorJsFile);
    document.head.appendChild(script);
  }

  async init() {
    if (!window.VanillaCalendar) return;

    const cartResponse = await fetch(`${window.routes.cart_url}.js`);
    const cart = await cartResponse.json();
    const deliveryDate = cart.attributes.delivery_date;

    const calendar = new window.VanillaCalendar(
      this.querySelector(".ks-cart-delivery-calendar-div"),
      {
        type: "default",
        settings: {
          lang: "en-US",
          selected: {
            dates: [deliveryDate],
          },
          visibility: {
            theme: "light",
          },
        },
        date: {
          min: "today",
        },
        actions: {
          clickDay: async (event, self) => {
            const deliveryDate = self.selectedDates[0] || "";

            this.setAlert(deliveryDate);

            await fetch(`${window.routes.cart_update_url}.js`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                attributes: {
                  delivery_date: deliveryDate,
                },
              }),
            });
          },
        },
      }
    );
    calendar.init();

    this.setAlert(deliveryDate);
  }

  setAlert(deliveryDate) {
    const alert = this.querySelector(".ks-alert");

    if (deliveryDate && deliveryDate.length) {
      alert.innerHTML = `${alert.dataset.textDeliveryDate}: <b>${deliveryDate}</b>`;
      alert.classList.add("ks-alert-success");
      alert.classList.remove("ks-alert-info");
    } else {
      alert.innerHTML = alert.dataset.textInit;
      alert.classList.remove("ks-alert-success");
      alert.classList.add("ks-alert-info");
    }
  }
}
customElements.define("ks-cart-delivery-calendar", KsCartDeliveryCalendar);
