import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Store,
  Check,
  CheckCircle,
  ShoppingCart,
} from "lucide-react";
import { useApp } from "../../contexts/AppContext";
import { useGroceryAPI } from "../../hooks/useGroceryAPI";
import { COLORS } from "../../utils/constants";
import Button from "../common/Button";
import NavBar from "../common/NavBar";
import Card from "../common/Card";
import LoadingSpinner from "../common/LoadingSpinner";
import "./ShoppingListScreen.css";

const ShoppingListScreen: React.FC = () => {
  const navigate = useNavigate();
  const { cart, comparison, clearCart, isLoading } = useApp();
  const { saveSavings } = useGroceryAPI();
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [completing, setCompleting] = useState(false);

  const handleGoBack = () => {
    navigate("/cart");
  };

  const toggleItem = (itemId: string) => {
    setCheckedItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const allChecked =
    cart.length > 0 && cart.every((item) => checkedItems[item.id]);

  const handleCompleteShopping = async () => {
    if (!comparison || !allChecked) return;

    setCompleting(true);
    try {
      const savingsRecord = {
        id: Date.now().toString(),
        best_store: comparison.best_store,
        total_cost: comparison.best_store_total,
        savings: comparison.savings,
        completed_at: new Date().toISOString(),
        shopping_list_id: Date.now().toString(),
        potential_costs: comparison.store_totals,
        items_count: cart.length,
      };

      await saveSavings(savingsRecord);
      clearCart();

      // Navigate to home with success message
      navigate("/");
    } catch (error) {
      console.error("Error completing shopping:", error);
    } finally {
      setCompleting(false);
    }
  };

  const formatPrice = (price: number): string => {
    return `$${price.toFixed(2)}`;
  };

  if (!comparison) {
    return (
      <div className="shopping-list-screen">
        <div className="shopping-container">
          <Card className="no-comparison-card">
            <h2>No Store Comparison Available</h2>
            <p>
              Please compare stores first before starting your shopping trip.
            </p>
            <Button onClick={handleGoBack} variant="primary" size="medium">
              Go Back to Cart
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <>
      <NavBar />
      <div className="shopping-list-screen">
        <div className="shopping-container">
          {/* Header */}
          <div className="shopping-header">
            <Button
              onClick={handleGoBack}
              variant="secondary"
              size="small"
              className="back-button"
            >
              <ArrowLeft size={20} />
            </Button>
            <h1 className="shopping-title">Shopping List</h1>
            <div className="spacer" />
          </div>

          {/* Store Info */}
          <Card className="store-info-card">
            <div className="store-header">
              <Store size={32} color={COLORS.PRIMARY} />
              <div className="store-details">
                <h2 className="store-name">
                  Shopping at: {comparison.best_store}
                </h2>
                <p className="total-items">{cart.length} items to find</p>
              </div>
            </div>
          </Card>

          {/* Shopping List */}
          {cart.length === 0 ? (
            <Card className="empty-list">
              <div className="empty-icon">
                <ShoppingCart size={64} color={COLORS.LIGHT_GRAY} />
              </div>
              <h3 className="empty-title">No items in your shopping list</h3>
              <p className="empty-description">
                Add items to your cart and compare stores to create a shopping
                list
              </p>
            </Card>
          ) : (
            <div className="shopping-list">
              {cart.map((item) => (
                <Card
                  key={item.id}
                  className={`shopping-item ${
                    checkedItems[item.id] ? "item-checked" : ""
                  }`}
                  onClick={() => toggleItem(item.id)}
                >
                  <div className="item-content">
                    <div className="checkbox">
                      {checkedItems[item.id] && (
                        <Check size={20} color={COLORS.PRIMARY} />
                      )}
                    </div>

                    <div className="item-details">
                      <h3
                        className={`item-name ${
                          checkedItems[item.id] ? "name-checked" : ""
                        }`}
                      >
                        {item.name}
                      </h3>
                      <p className="item-details-text">
                        Qty: {item.quantity} | {formatPrice(item.current_price)}{" "}
                        each
                      </p>
                      <p className="item-store">{item.merchant}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Progress Indicator */}
          {cart.length > 0 && (
            <Card className="progress-card">
              <div className="progress-content">
                <div className="progress-text">
                  <span className="progress-count">
                    {Object.values(checkedItems).filter(Boolean).length} of{" "}
                    {cart.length} items found
                  </span>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${
                          (Object.values(checkedItems).filter(Boolean).length /
                            cart.length) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Complete Shopping Button */}
          {allChecked && (
            <Button
              onClick={handleCompleteShopping}
              disabled={completing}
              loading={completing}
              variant="primary"
              size="large"
              className="complete-button"
            >
              <CheckCircle size={24} />
              {completing ? "Completing Shopping..." : "Complete Shopping"}
            </Button>
          )}

          {/* Shopping Summary */}
          {comparison && (
            <Card className="summary-card">
              <h3 className="summary-title">Shopping Summary</h3>
              <div className="summary-row">
                <span>Store:</span>
                <span>{comparison.best_store}</span>
              </div>
              <div className="summary-row">
                <span>Total Cost:</span>
                <span>{formatPrice(comparison.best_store_total)}</span>
              </div>
              <div className="summary-row savings">
                <span>Estimated Savings:</span>
                <span>{formatPrice(comparison.savings)}</span>
              </div>
            </Card>
          )}

          {/* Loading Overlay */}
          {(isLoading || completing) && (
            <div className="loading-overlay">
              <LoadingSpinner
                size="large"
                text={
                  completing ? "Completing your shopping trip..." : "Loading..."
                }
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ShoppingListScreen;
