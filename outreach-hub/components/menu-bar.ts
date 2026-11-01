/// <reference lib="dom" />

const menuItems = [
  { label: 'Events', href: 'index.html' },
  { label: 'Outreach Champions', href: 'people.html' },
  { label: 'Objectives', href: 'objectives.html' },
] as const;

export type MenuBarProps = {
  activePage?: string;
  subheader?: string;
};

export class MenuBar extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['active-page', 'subheader'];
  }

  private readonly root = this.attachShadow({ mode: 'open' });

  connectedCallback(): void {
    this.render();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.render();
  }

  private render(): void {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = 'components/menu-bar.module.css';

    const header = document.createElement('header');
    const navigation = document.createElement('nav');
    navigation.setAttribute('aria-label', 'Main navigation');

    const brand = document.createElement('a');
    brand.className = 'brand';
    brand.href = 'index.html';
    const title = document.createElement('h1');
    const image = document.createElement('img');
    image.src = './bbc-logo-white-rgb.png';
    image.alt = 'BBC Outreach Hub Logo';
    brand.append(image);
    title.textContent = ' Outreach Hub';
    brand.append(title);

    const list = document.createElement('ul');
    const activePage = this.getAttribute('active-page')
      ?? window.location.pathname.split('/').pop()
      ?? 'index.html';

    for (const item of menuItems) {
      const listItem = document.createElement('li');
      const link = document.createElement('a');
      link.href = item.href;
      link.textContent = item.label;
      if (item.href === (activePage || 'index.html')) {
        link.setAttribute('aria-current', 'page');
      }
      listItem.append(link);
      list.append(listItem);
    }

    navigation.append(brand, list);
    header.append(navigation);

    const subheader = this.getAttribute('subheader');
    if (subheader) {
      const subtitle = document.createElement('h2');
      subtitle.className = 'subheader';
      subtitle.textContent = subheader;
      header.append(subtitle);
    }

    const actions = document.createElement('slot');
    actions.name = 'actions';
    header.append(actions);
    this.root.replaceChildren(style, header);
  }
}

if (!customElements.get('outreach-menu-bar')) {
  customElements.define('outreach-menu-bar', MenuBar);
}