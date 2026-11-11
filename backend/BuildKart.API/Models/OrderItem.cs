using System.ComponentModel.DataAnnotations;

namespace BuildKart.API.Models;

public sealed class OrderItem
{
    public int Id { get; set; }

    [Range(1, int.MaxValue)]
    public int OrderId { get; set; }

    [Range(1, int.MaxValue)]
    public int ProductId { get; set; }

    [Range(typeof(decimal), "0.001", "100000")]
    public decimal Quantity { get; set; }

    [Range(typeof(decimal), "0.01", "999999999")]
    public decimal UnitPriceAtOrder { get; set; }

    public decimal LineTotal { get; private set; }
    public Order Order { get; set; } = null!;
    public Product Product { get; set; } = null!;
}
