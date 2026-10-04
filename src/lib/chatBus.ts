export const OPEN_CHAT_EVENT = 'forge:open-chat';

export function openChatWidget() {
  window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT));
}
