import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  AlertOctagon,
  ShoppingBag,
  DollarSign,
  Truck,
  MessageSquare,
  FileText,
} from "lucide-react";
import React from "react";

export type SeverityType = "INFO" | "SUCCESS" | "WARNING" | "URGENT";

export type NotificationType =
  | "ORDER_NEW"
  | "PAYMENT_CONFIRMATION_REQUIRED"
  | "DELIVERY_STATUS_CHANGED"
  | "YANDEX_CREATION_REMINDER"
  | "RETURN_CASE_OPENED"
  | "RETURN_SELLER_RESPONSE_REQUIRED"
  | "RETURN_ADMIN_REVIEW_REQUIRED"
  | "SELLER_FEE_INVOICE_ISSUED"
  | "ORDER_FULFILLMENT_OVERDUE"
  | "SYSTEM";

export interface SeverityConfig {
  colorClass: string;
  bgClass: string;
  borderClass: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const SEVERITY_CONFIGS: Record<SeverityType, SeverityConfig> = {
  INFO: {
    colorClass: "text-blue-500 dark:text-blue-400",
    bgClass: "bg-blue-50 dark:bg-blue-950/30",
    borderClass: "border-blue-100 dark:border-blue-900/50",
    icon: Info,
  },
  SUCCESS: {
    colorClass: "text-green-500 dark:text-green-400",
    bgClass: "bg-green-50 dark:bg-green-950/30",
    borderClass: "border-green-100 dark:border-green-900/50",
    icon: CheckCircle2,
  },
  WARNING: {
    colorClass: "text-amber-500 dark:text-amber-400",
    bgClass: "bg-amber-50 dark:bg-amber-950/30",
    borderClass: "border-amber-100 dark:border-amber-900/50",
    icon: AlertTriangle,
  },
  URGENT: {
    colorClass: "text-red-500 dark:text-red-400",
    bgClass: "bg-red-50 dark:bg-red-950/30",
    borderClass: "border-red-100 dark:border-red-900/50",
    icon: AlertOctagon,
  },
};

export interface NotificationTypeConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const TYPE_CONFIGS: Record<string, NotificationTypeConfig> = {
  ORDER_NEW: {
    label: "Đơn hàng mới",
    icon: ShoppingBag,
  },
  PAYMENT_CONFIRMATION_REQUIRED: {
    label: "Thanh toán cần xác nhận",
    icon: DollarSign,
  },
  DELIVERY_STATUS_CHANGED: {
    label: "Cập nhật vận chuyển",
    icon: Truck,
  },
  YANDEX_CREATION_REMINDER: {
    label: "Nhắc nhở tạo đơn Yandex",
    icon: Truck,
  },
  RETURN_CASE_OPENED: {
    label: "Khiếu nại trả hàng/hoàn tiền mới",
    icon: MessageSquare,
  },
  RETURN_SELLER_RESPONSE_REQUIRED: {
    label: "Phản hồi khiếu nại yêu cầu",
    icon: MessageSquare,
  },
  RETURN_ADMIN_REVIEW_REQUIRED: {
    label: "Admin cần can thiệp",
    icon: AlertTriangle,
  },
  SELLER_FEE_INVOICE_ISSUED: {
    label: "Hóa đơn phí nền tảng",
    icon: FileText,
  },
  ORDER_FULFILLMENT_OVERDUE: {
    label: "Đơn hàng quá hạn",
    icon: AlertOctagon,
  },
  SYSTEM: {
    label: "Thông báo hệ thống",
    icon: Bell,
  },
};
