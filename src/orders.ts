
import rawOrders from "../data/orders.json";
import { normalizeOrders, type RawOrder } from "./normalizeOrders";

const orders = normalizeOrders(rawOrders as RawOrder[]);

export default orders;
