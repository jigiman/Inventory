using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddFifoBatchTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "CostPrice",
                table: "StockTransactions",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "RemainingQuantity",
                table: "StockTransactions",
                type: "TEXT",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "SupplierId",
                table: "StockTransactions",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CostPrice",
                table: "SaleItems",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SupplierId",
                table: "SaleItems",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_StockTransactions_SupplierId",
                table: "StockTransactions",
                column: "SupplierId");

            migrationBuilder.CreateIndex(
                name: "IX_SaleItems_SupplierId",
                table: "SaleItems",
                column: "SupplierId");

            migrationBuilder.AddForeignKey(
                name: "FK_SaleItems_Suppliers_SupplierId",
                table: "SaleItems",
                column: "SupplierId",
                principalTable: "Suppliers",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_StockTransactions_Suppliers_SupplierId",
                table: "StockTransactions",
                column: "SupplierId",
                principalTable: "Suppliers",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SaleItems_Suppliers_SupplierId",
                table: "SaleItems");

            migrationBuilder.DropForeignKey(
                name: "FK_StockTransactions_Suppliers_SupplierId",
                table: "StockTransactions");

            migrationBuilder.DropIndex(
                name: "IX_StockTransactions_SupplierId",
                table: "StockTransactions");

            migrationBuilder.DropIndex(
                name: "IX_SaleItems_SupplierId",
                table: "SaleItems");

            migrationBuilder.DropColumn(
                name: "CostPrice",
                table: "StockTransactions");

            migrationBuilder.DropColumn(
                name: "RemainingQuantity",
                table: "StockTransactions");

            migrationBuilder.DropColumn(
                name: "SupplierId",
                table: "StockTransactions");

            migrationBuilder.DropColumn(
                name: "CostPrice",
                table: "SaleItems");

            migrationBuilder.DropColumn(
                name: "SupplierId",
                table: "SaleItems");
        }
    }
}
