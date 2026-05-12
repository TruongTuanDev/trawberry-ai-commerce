import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './button.html',
  styleUrl: './button.css',
})
export class Button {
  variant = input<'primary' | 'secondary' | 'outline' | 'danger'>('primary');
  type = input<'button' | 'submit'>('button');
  disabled = input<boolean>(false);
  loading = input<boolean>(false);
  fullWidth = input<boolean>(false);

  buttonClick = output<MouseEvent>();

  buttonClass = computed(() => {
    let base = `btn-${this.variant()}`;
    if (this.fullWidth()) {
      base += ' w-full';
    }
    if (this.loading()) {
      base += ' cursor-wait opacity-70';
    }
    return base;
  });

  onClick(event: MouseEvent) {
    if (!this.disabled() && !this.loading()) {
      this.buttonClick.emit(event);
    }
  }
}
